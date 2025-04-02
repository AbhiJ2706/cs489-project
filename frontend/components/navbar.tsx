"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Music,
  Upload,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  Search,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navItems = [
    {
      name: "Home",
      href: "/",
      isActive: pathname === "/",
    },
    {
      name: "Upload",
      href: "/upload",
      isActive: pathname === "/upload",
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-8">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <Music className="h-6 w-6" />
            <span className="font-bold">DaScore</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:flex-1">
          <nav className="flex items-center space-x-4 lg:space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  item.isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Search */}
        <div className="hidden md:flex md:flex-1 md:justify-center">
          <form onSubmit={handleSearch} className="w-full max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search scores..."
                className="w-full bg-background pl-8 md:w-[300px] lg:w-[400px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>

        {/* User Authentication */}
        <div className="hidden md:flex md:items-center md:justify-end md:flex-1">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {user?.profile_image ? (
                    <AvatarImage src={user.profile_image} alt={user.name} />
                  ) : (
                    <AvatarFallback>
                      {user?.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="text-sm font-medium hidden lg:inline-block">
                  {user?.name}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                <LogOut className="h-4 w-4 mr-2" />
                <span>Logout</span>
              </Button>
            </div>
          ) : (
            <Link href="/signin">
              <Button variant="default" size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                <span>Sign In</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden flex-1 justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between border-b pb-4">
                  <Link href="/" className="flex items-center gap-2">
                    <Music className="h-6 w-6" />
                    <span className="font-bold">DaScore</span>
                  </Link>
                  <SheetClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </div>

                <div className="py-4">
                  <form onSubmit={handleSearch} className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search scores..."
                        className="w-full pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </form>

                  <nav className="flex flex-col space-y-4">
                    {navItems.map((item) => (
                      <SheetClose asChild key={item.name}>
                        <Link
                          href={item.href}
                          className={`flex items-center text-sm font-medium transition-colors hover:text-primary ${
                            item.isActive
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.name === "Home" ? (
                            <Music className="mr-2 h-4 w-4" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          {item.name}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                </div>

                <div className="mt-auto border-t pt-4">
                  {isAuthenticated ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {user?.profile_image ? (
                            <AvatarImage
                              src={user.profile_image}
                              alt={user.name}
                            />
                          ) : (
                            <AvatarFallback>
                              {user?.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <span className="text-sm font-medium">{user?.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => logout()}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        <span>Logout</span>
                      </Button>
                    </div>
                  ) : (
                    <SheetClose asChild>
                      <Link href="/signin">
                        <Button className="w-full">
                          <LogIn className="h-4 w-4 mr-2" />
                          <span>Sign In</span>
                        </Button>
                      </Link>
                    </SheetClose>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
