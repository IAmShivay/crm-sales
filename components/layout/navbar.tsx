"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import { useAppSelector } from "@/lib/store/hooks";

export function Navbar() {
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.user);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Leads", href: "/leads" },
    { name: "Messages", href: "/messages" },
    { name: "Calls", href: "/calls" },
    { name: "Analytics", href: "/analytics" },
  ];

  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/" className="font-bold text-2xl mr-8">
          CRM
        </Link>
        {user ? (
          <>
            <div className="flex items-center space-x-4 lg:space-x-6 mx-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center space-x-4">
              <ThemeToggle />
              <UserNav />
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center space-x-4">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}