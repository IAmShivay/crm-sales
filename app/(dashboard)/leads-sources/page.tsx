"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Copy, Loader } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useWebhookMutation } from "@/lib/store/services/webhooks";
import { useGetWebhooksQuery } from "@/lib/store/services/webhooks";
import { v4 as uuidv4 } from "uuid";
import { useGetActiveWorkspaceQuery } from "@/lib/store/services/workspace";
// Zod validation schema
const sourceSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  type: z.string().min(2, { message: "Type must be at least 2 characters" }),
  description: z.string().optional(),
  status: z.boolean().optional(),
});
export type Source = {
  webhook?: string; // URL as a string
  created_at?: string; // ISO 8601 formatted date string
  description?: string; // String, can be empty
  id: string; // UUID
  name: string; // Name of the source
  status: boolean; // True or false, indicates the status
  type: string; // Type of the source (e.g., 'ded')
  user_id?: string; // User UUID associated with the source
  webhook_url?: string; // URL as a string
  workspace_id?: string | null; // Can be a string or null
};
const LeadSourceManager: React.FC = () => {
  const { data: workspacesData } = useGetActiveWorkspaceQuery();
  console.log(workspacesData);
  const [webhook] = useWebhookMutation();
  const { data: webhooks, isLoading, isError, error } = useGetWebhooksQuery();
  const webhooksData = webhooks?.data;
  const [sources, setSources] = useState<Source[]>(webhooksData || []);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<
    "create" | "edit" | "delete" | null
  >(null);
  useEffect(() => {
    if (webhooks?.data) {
      setSources(webhooks.data);
    }
  }, [webhooks]);
  console.log(webhooksData);
  const form = useForm<z.infer<typeof sourceSchema>>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
    },
  });

  const resetDialog = () => {
    form.reset();
    setSelectedSource(null);
    setDialogMode(null);
  };

  const openCreateDialog = () => {
    resetDialog();
    setDialogMode("create");
  };

  const openEditDialog = (source: (typeof sources)[number]) => {
    form.reset({
      name: source.name,
      type: source.type,
      description: source.description,
    });
    setSelectedSource(source);
    setDialogMode("edit");
  };

  const openDeleteDialog = (source: (typeof sources)[number]) => {
    setSelectedSource(source);
    setDialogMode("delete");
  };

  const copyWebhook = (webhook: string) => {
    navigator.clipboard.writeText(webhook);
    // You could add a toast notification here
  };

  // Function to toggle webhook status
  const toggleWebhookStatus = (sourceId: string) => {
    setSources(
      sources.map((source) =>
        source.id === sourceId ? { ...source, status: !source.status } : source
      )
    );
  };

  const onSubmit = async (data: z.infer<typeof sourceSchema>) => {
    if (dialogMode === "create") {
      // Simulate new webhook URL for demo
      const newId: any = uuidv4().toString();
      const newWebhook = `${process.env.NEXT_PUBLIC_BASE_URL
        }/leads?action=${"getLeads"}&sourceId=${newId}&workspaceId=${workspacesData?.data.id}`;

      setSources([
        ...sources,
        {
          id: newId,
          ...data,
          webhook: newWebhook,
          description: data.description || "",
          status: true, // New sources are enabled by default
        },
      ]);
      try {
        await webhook({
          status: true,
          type: data.type,
          name: data.name,
          webhook_url: newWebhook,
        });
      } catch (error) { }
      console.log("New source added:", newWebhook, data);
    } else if (dialogMode === "edit" && selectedSource) {
      setSources(
        sources.map((source) =>
          source.id === selectedSource.id
            ? {
              ...source,
              ...data,
              description: data.description || "",
            }
            : source
        )
      );
    }
    resetDialog();
  };


  const handleDelete = () => {
    if (selectedSource) {
      setSources(sources.filter((source) => source.id !== selectedSource.id));
      resetDialog();
    }
  };
  if (!workspacesData?.data?.id) return <div><Loader /></div>;

  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      <Card className="w-full">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
          <CardTitle className="text-lg md:text-xl lg:text-2xl">
            Lead Sources
          </CardTitle>
          <Button onClick={openCreateDialog} className="w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Source
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>{source.name}</TableCell>
                    <TableCell>{source.type}</TableCell>
                    <TableCell>{source.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="truncate max-w-xs">
                          {source.webhook_url}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyWebhook(source.webhook_url ?? "")}
                          className="h-8 w-8"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={source.status}
                          onCheckedChange={() => toggleWebhookStatus(source.id)}
                        />
                        <span
                          className={`text-sm ${source.status ? "text-green-600" : "text-red-600"
                            }`}
                        >
                          {source.status ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEditDialog(source)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => openDeleteDialog(source)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onOpenChange={() => resetDialog()}
      >
        <DialogContent className="w-[90%] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create"
                ? "Add New Lead Source"
                : "Edit Lead Source"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter source name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Type</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter source type" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter source description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" className="w-full sm:w-auto">
                  {dialogMode === "create" ? "Add Source" : "Update Source"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogMode === "delete"} onOpenChange={() => resetDialog()}>
        <DialogContent className="w-[90%] max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="mb-4">
            Are you sure you want to delete the lead source &quot;
            {selectedSource?.name}&quot;?
          </p>
          <DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadSourceManager;
