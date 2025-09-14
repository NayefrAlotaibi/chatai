'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useUIMode } from './ui/ui-mode';
import { SidebarGroup, SidebarGroupContent, SidebarMenuItem } from './ui/sidebar';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { mode, setMode, setView } = useUIMode();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row items-center justify-between">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row items-center gap-3"
            >
              <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                Chatbot
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="h-8 p-1 md:h-fit md:p-2"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end" className="hidden md:block">
                New Chat
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {mode === 'chat' ? (
          <SidebarHistory user={user} />
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <button
                    className="flex w-full items-center rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50"
                    onClick={() => {
                      setView('overview' as any);
                      setOpenMobile(false);
                    }}
                  >
                    Dashboard
                  </button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <button
                    className="flex w-full items-center rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50"
                    onClick={() => {
                      setView('receipts');
                      setOpenMobile(false);
                    }}
                  >
                    Receipts
                  </button>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <button
                    className="flex w-full items-center rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50"
                    onClick={() => {
                      setView('bank' as any);
                      setOpenMobile(false);
                    }}
                  >
                    Bank Statement
                  </button>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <SidebarUserNav user={user} />
        ) : (
          <Button
            variant="default"
            className="w-full"
            onClick={() => {
              router.push('/api/auth/guest');
            }}
          >
            Continue as Guest
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
