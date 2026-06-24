'use client';

import { deleteUser, updateUserRole } from '@/app/admin/users/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminUser, RoleSummary } from '@cmstack-ts/config';
import { Loader2, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface UserRowActionsProps {
  user: AdminUser;
  roles: RoleSummary[];
  isSelf: boolean;
}

export function UserRowActions({ user, roles, isSelf }: UserRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(user.role?.id ?? '');

  function handleChangeRole() {
    if (!selectedRoleId) return;
    startTransition(async () => {
      const result = await updateUserRole(user.id, selectedRoleId);
      if (result.ok) {
        toast.success('Role updated');
        setRoleDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.ok) {
        toast.success('User deleted');
        setDeleteDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            disabled={isPending}
            aria-label={`Actions for ${user.name ?? user.email}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isSelf}
            onClick={() => {
              if (!isSelf) setRoleDialogOpen(true);
            }}
            className={isSelf ? 'opacity-50 cursor-not-allowed' : ''}
            aria-disabled={isSelf}
          >
            <ShieldCheck className="h-4 w-4" />
            Change role
            {isSelf ? <span className="ml-auto text-[10px] text-muted-foreground">You</span> : null}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf}
            onClick={() => {
              if (!isSelf) setDeleteDialogOpen(true);
            }}
            className={
              isSelf
                ? 'opacity-50 cursor-not-allowed'
                : 'text-destructive focus:text-destructive focus:bg-destructive/5'
            }
            aria-disabled={isSelf}
          >
            <Trash2 className="h-4 w-4" />
            Delete
            {isSelf ? <span className="ml-auto text-[10px] text-muted-foreground">You</span> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change role dialog */}
      <Dialog
        open={roleDialogOpen}
        onOpenChange={(open) => {
          setRoleDialogOpen(open);
          if (!open) setSelectedRoleId(user.role?.id ?? '');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Update the role for{' '}
              <span className="font-medium text-foreground">{user.name ?? user.email}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`role-select-${user.id}`}>Role</Label>
            <Select
              value={selectedRoleId || 'none'}
              onValueChange={(v) => setSelectedRoleId(v === 'none' ? '' : v)}
            >
              <SelectTrigger id={`role-select-${user.id}`}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" disabled={isPending || !selectedRoleId} onClick={handleChangeRole}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{user.name ?? user.email}</span> will be
              permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
