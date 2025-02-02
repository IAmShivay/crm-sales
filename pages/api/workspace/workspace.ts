import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabaseServer"; // Import the Supabase client
import { AUTH_MESSAGES } from "@/lib/constant/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, body, query, headers } = req;
  const action = query.action as string;
  switch (method) {
    case "POST": {
      if (!method) {
        return res.status(400).json({ error: AUTH_MESSAGES.SIGNUP_FAILED });
      }
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
      }
      const token = authHeader.split(" ")[1];

      switch (action) {
        case "createWorkspace": {
          const {
            name,
            status,
            companyType,
            companySize,
            industry,
            timezone,
            notifications,
          } = body;

          const {
            data: { user },
          } = await supabase.auth.getUser(token);
          if (!user) {
            return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
          }

          if (!name || !status || !companyType || !companySize || !industry) {
            return res.status(400).json({ error: "Missing required fields" });
          }

          try {
            const { data: membershipData, error: membershipError } =
              await supabase
                .from("workspace_members")
                .select("*")
                .eq("user_id", user.id);

            if (membershipError) {
              return res.status(500).json({ error: membershipError.message });
            }

            if (membershipData && membershipData.length > 0) {
              return res.status(403).json({
                error:
                  "User is already a member of a workspace and cannot create a new one",
              });
            }

            const { data, error } = await supabase.from("workspaces").insert([
              {
                name,
                status,
                company_type: companyType,
                company_size: companySize,
                industry,
                timezone,
                notifications,
                owner_id: user?.id,
              },
            ]);

            // await supabase.from("workspace_members").insert({
            //   role: "SuperAdmin",
            //   added_by: user?.id,
            //   email: user?.email,
            //   status: "accepted",
            //   user_id: user?.id,
            // });

            if (error) {
              return res.status(500).json({ error: error.message });
            }

            return res.status(201).json({ message: "Workspace created", data });
          } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "An error occurred" });
          }
        }
        default:
          return res.status(400).json({ error: "Invalid action" });
      }
    }
    case "GET": {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
      }
      const token = authHeader.split(" ")[1];

      switch (action) {
        case "getWorkspaces": {
          const {
            data: { user },
          } = await supabase.auth.getUser(token);

          if (!user) {
            return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
          }

          try {
            const { data: ownedWorkspaces, error: ownedError } = await supabase
              .from("workspaces")
              .select("*")
              .eq("owner_id", user.id);

            if (ownedError) {
              return res.status(500).json({ error: ownedError.message });
            }

            const { data: memberWorkspaces, error: memberError } =
              await supabase
                .from("workspace_members")
                .select("workspace_id")
                .eq("email", user.email);

            if (memberError) {
              return res.status(500).json({ error: memberError.message });
            }
            const workspaceIds: any = [
              ...new Set([
                ...ownedWorkspaces.map((ws) => ws.id),
                ...memberWorkspaces.map((ws) => ws.workspace_id),
              ]),
            ].filter((id) => id !== null && id !== undefined);

            const { data: allWorkspaces, error: allWorkspacesError } =
              await supabase
                .from("workspaces")
                .select("*")
                .in("id", workspaceIds);

            if (allWorkspacesError) {
              return res
                .status(500)
                .json({ error: allWorkspacesError.message });
            }
            return res
              .status(200)
              .json({ message: "Workspaces fetched", data: allWorkspaces });
          } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "An error occurred" });
          }
        }
        case "getWorkspaceMembers": {
          const { workspaceId } = query;
          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          const { data, error } = await supabase
            .from("workspace_members")
            .select()
            .eq("workspace_id", workspaceId);

          if (error) {
            return res.status(400).json({ error: error.message });
          }

          return res.status(200).json({ data });
        }

        case "getWorkspacesById": {
          const {
            data: { user },
          } = await supabase.auth.getUser(token);

          if (!user) {
            return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
          }

          const { workspaceId } = req.query;

          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          try {
            const { data: workspace, error: workspaceError } = await supabase
              .from("workspaces")
              .select("*")
              .eq("id", workspaceId)
              .single();

            if (workspaceError) {
              return res.status(500).json({ error: workspaceError.message });
            }

            if (!workspace) {
              return res.status(404).json({ error: "Workspace not found" });
            }

            // Check if the user is the owner
            if (workspace.owner_id === user.id) {
              return res
                .status(200)
                .json({ message: "Workspace fetched", data: workspace });
            }

            // Check if the user is a member
            const { data: membership, error: membershipError } = await supabase
              .from("workspace_members")
              .select("*")
              .eq("workspace_id", workspaceId)
              .eq("user_id", user.id)
              .single(); // Expect only one match

            if (membershipError) {
              return res.status(500).json({ error: membershipError.message });
            }

            if (!membership) {
              return res
                .status(403)
                .json({ error: AUTH_MESSAGES.UNAUTHORIZED });
            }

            // Return workspace data if the user is a member
            return res
              .status(200)
              .json({ message: "Workspace fetched", data: workspace });
          } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "An error occurred" });
          }
        }

        case "getActiveWorkspace": {
          const {
            data: { user },
          } = await supabase.auth.getUser(token);
          if (!user) {
            return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
          }

          // First, try to find workspace where user is owner
          let { data: ownerWorkspace, error: ownerError } = await supabase
            .from("workspaces")
            .select("*")
            .eq("status", true)
            .eq("owner_id", user.id)
            .limit(1)
            .single();

          if (!ownerError && ownerWorkspace) {
            return res.status(200).json({ data: ownerWorkspace });
          }

          // If not owner, check workspace_members table
          const { data: memberWorkspace, error: memberError } = await supabase
            .from("workspace_members")
            .select(
              `
            *,
            workspace:workspace_id (*)
          `
            )
            .eq("status", "accepted")
            .eq("user_id", user.id)
            .limit(1)
            .single();
          console.log(memberWorkspace);
          if (memberError) {
            return res.status(400).json({ error: memberError.message });
          }

          if (!memberWorkspace) {
            return res.status(404).json({ error: "No active workspace found" });
          }

          return res.status(200).json({ data: memberWorkspace.workspace });
        }
        case "getLeadsRevenueByWorkspace": {
          const { workspaceId } = query;

          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          try {
            const { data, error } = await supabase.rpc(
              "calculate_total_revenue",
              {
                workspace_id: workspaceId,
              }
            );

            if (error) {
              console.error("Error calculating revenue:", error);
              return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ totalRevenue: data });
          } catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
        case "getQualifiedLeadsCount": {
          const { workspaceId } = query;

          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          try {
            // First, get all statuses where count_statistics is true
            const { data: qualifiedStatuses, error: statusError } =
              await supabase
                .from("status")
                .select("name")
                .eq("count_statistics", true);

            if (statusError) {
              console.error("Error fetching qualified statuses:", statusError);
              return res.status(400).json({ error: statusError.message });
            }

            // Extract status names that should be counted
            const qualifiedStatusNames = qualifiedStatuses.map(
              (status) => status.name
            );
            console.error(qualifiedStatusNames);

            // Count leads that match the qualified status names for the given workspace
            // Using ->> operator to access the name field within the status JSON object
            const { data: leadsCount, error: leadsError } = await supabase
              .from("leads")
              .select("id", { count: "exact" })
              .eq("work_id", workspaceId)
              .filter("status->>name", "in", `(${qualifiedStatusNames})`);
            if (leadsError) {
              console.error("Error counting qualified leads:", leadsError);
              return res.status(400).json({ error: leadsError.message });
            }

            return res.status(200).json({
              qualifiedLeadsCount: leadsCount?.length,
              qualifiedStatuses: qualifiedStatusNames,
            });
          } catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
        case "getArrivedLeadsCount": {
          const { workspaceId } = query;

          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          // Convert workspaceId to integer
          const workspaceIdInt = parseInt(workspaceId as string);
          if (isNaN(workspaceIdInt)) {
            return res
              .status(400)
              .json({ error: "Invalid workspace ID format" });
          }

          try {
            const { data, error } = await supabase.rpc("count_arrived_leads", {
              workspace_id: workspaceIdInt,
            });

            if (error) {
              console.error("Error counting arrived leads:", error);
              return res.status(400).json({ error: error.message });
            }

            return res.status(200).json({ arrivedLeadsCount: data });
          } catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
        case "getWorkspaceAnalytics": {
          const { workspaceId } = query;
          const token = authHeader.split(" ")[1];

          // Validate workspace ID presence
          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          // Parse and validate workspace ID format
          const workspaceIdInt = parseInt(workspaceId as string);
          if (isNaN(workspaceIdInt)) {
            return res
              .status(400)
              .json({ error: "Invalid workspace ID format" });
          }

          try {
            // Get user from token
            const {
              data: { user },
              error: userError,
            } = await supabase.auth.getUser(token);

            if (userError) {
              return res.status(401).json({ error: "Unauthorized" });
            }

            // Fetch webhooks for the workspace
            const { data: webhooks, error: webhooksError } = await supabase
              .from("webhooks")
              .select("*")
              .eq("workspace_id", workspaceIdInt);

            if (webhooksError) {
              console.error("Error fetching webhooks:", webhooksError);
              return res
                .status(500)
                .json({ error: "Failed to fetch webhooks" });
            }

            // Get lead counts for each webhook
            const webhookAnalytics = await Promise.all(
              webhooks.map(async (webhook) => {
                // Extract source_id from webhook URL
                const url = new URL(webhook.webhook_url);
                const sourceId = url.searchParams.get("sourceId");

                if (!sourceId) {
                  return {
                    webhook_name: webhook.name,
                    lead_count: 0,
                    webhook_url: webhook.webhook_url,
                  };
                }

                // Fetch leads count for this webhook's source
                const { count, error: leadsError } = await supabase
                  .from("leads")
                  .select("*", { count: "exact", head: true })
                  .eq("work_id", workspaceIdInt)
                  .eq("lead_source_id", sourceId);

                if (leadsError) {
                  console.error(
                    `Error fetching leads for webhook ${webhook.name}:`,
                    leadsError
                  );
                  return {
                    webhook_name: webhook.name,
                    lead_count: 0,
                    webhook_url: webhook.webhook_url,
                    error: "Failed to fetch leads count",
                  };
                }

                return {
                  webhook_name: webhook.name,
                  lead_count: count || 0,
                  webhook_url: webhook.webhook_url,
                };
              })
            );

            return res.status(200).json(webhookAnalytics);
          } catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
        case "getTotalLeadsCount": {
          const { workspaceId } = query;

          if (!workspaceId) {
            return res.status(400).json({ error: "Workspace ID is required" });
          }

          // Convert workspaceId to bigint
          const workspaceIdBigInt = BigInt(workspaceId as string);
          console.log(workspaceIdBigInt);

          try {
            const { data, error } = await supabase.rpc(
              "calculate_conversion_metrics_with_monthly",
              {
                workspace_id: workspaceId, // Pass as string since JS BigInt isn't directly supported
              }
            );

            if (error) {
              console.error("Error calculating conversion metrics:", error);
              return res.status(400).json({ error: error.message });
            }
            return res.status(200).json(data[0]);
          } catch (error) {
            console.error("Error:", error);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
        default:
          return res.status(400).json({ error: "Invalid action" });
      }
    }
    case "PATCH": {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
      }
      const token = authHeader.split(" ")[1];

      switch (action) {
        case "updateWorkspaceStatus": {
          const { id: workspace_id, status } = body;
          if (!workspace_id || typeof status === "undefined") {
            return res.status(400).json({
              error: "workspace_id, status, and user_id are required",
            });
          }

          try {
            const {
              data: { user },
            } = await supabase.auth.getUser(token);
            if (!user) {
              return res
                .status(401)
                .json({ error: AUTH_MESSAGES.UNAUTHORIZED });
            }
            // Set all statuses to false for workspaces owned by the user
            const resetStatus = await supabase
              .from("workspaces")
              .update({ status: false })
              .eq("owner_id", user.id); // Assuming `owner_id` is the column for workspace ownership

            if (resetStatus.error) {
              throw new Error(resetStatus.error.message);
            }

            // Update the specific workspace's status to true
            const updateStatus = await supabase
              .from("workspaces")
              .update({ status: true })
              .eq("id", workspace_id)
              .eq("owner_id", user.id); // Ensure the workspace belongs to the user

            if (updateStatus.error) {
              throw new Error(updateStatus.error.message);
            }

            return res
              .status(200)
              .json({ message: "Workspace status updated successfully" });
          } catch (error: any) {
            console.error("Error updating workspace status:", error.message);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
      }
    }
    case "PUT": {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: AUTH_MESSAGES.UNAUTHORIZED });
      }
      const token = authHeader.split(" ")[1];

      switch (action) {
        case "updateWorkspaceDetails": {
          const { id: workspace_id, data } = body;
          if (!workspace_id || !data || typeof data !== "object") {
            return res.status(400).json({
              error: "workspace_id and valid data object are required",
            });
          }

          try {
            const {
              data: { user },
            } = await supabase.auth.getUser(token);

            if (!user) {
              return res
                .status(401)
                .json({ error: AUTH_MESSAGES.UNAUTHORIZED });
            }

            // Ensure the workspace belongs to the user
            const workspaceExists = await supabase
              .from("workspaces")
              .select("id")
              .eq("id", workspace_id)
              .eq("owner_id", user.id)
              .single();

            if (!workspaceExists.data) {
              return res
                .status(404)
                .json({ error: "Workspace not found or access denied" });
            }

            // Update the workspace with the data from the request body
            const updateWorkspace = await supabase
              .from("workspaces")
              .update(data)
              .eq("id", workspace_id)
              .eq("owner_id", user.id); // Ensure ownership

            if (updateWorkspace.error) {
              throw new Error(updateWorkspace?.error?.message);
            }

            return res.status(200).json({
              message: "Workspace updated successfully",
              data: updateWorkspace.data,
            });
          } catch (error: any) {
            console.error("Error updating workspace:", error.message);
            return res.status(500).json({ error: "Internal server error" });
          }
        }
      }
    }

    default:
      return res.status(405).json({ error: "Method Not Allowed" });
  }
}
