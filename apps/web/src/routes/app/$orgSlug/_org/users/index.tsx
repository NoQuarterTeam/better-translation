import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@better-translation/ui/components/alert-dialog"
import { Badge } from "@better-translation/ui/components/badge"
import { Button } from "@better-translation/ui/components/button"
import { Card, CardContent } from "@better-translation/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@better-translation/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@better-translation/ui/components/dropdown-menu"
import { Input } from "@better-translation/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@better-translation/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@better-translation/ui/components/tabs"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { CrownIcon, MoreVerticalIcon, PlusIcon, ShieldIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createT } from "better-translation/runtime"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import type { OrganizationRole } from "@/lib/auth/permissions"
import { getInvitationStatusBadgeVariant, getInvitationStatusLabel } from "@/lib/static/invitation"
import {
  getOrganizationRoleDescription,
  getOrganizationRoleLabel,
  MANAGEABLE_ORGANIZATION_ROLE_OPTIONS,
  type ManageableOrganizationRole,
} from "@/lib/static/organization"

import {
  cancelOrganizationInvitationFn,
  inviteOrganizationMembersFn,
  type listOrganizationInvitationsFn,
  type listOrganizationMembersFn,
  organizationInvitationsQueryOptions,
  organizationMembersQueryOptions,
  organizationUsersPageContextQueryOptions,
  removeOrganizationMemberFn,
  updateOrganizationMemberRoleFn,
} from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_org/users/")({
  component: UsersPage,
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(organizationMembersQueryOptions(params.orgSlug)),
      context.queryClient.ensureQueryData(organizationUsersPageContextQueryOptions(params.orgSlug)),
    ])
  },
  head: ({ match }) => {
    const t = createT(match.context.messages)
    return { meta: [{ title: `${t("Users")} · Better Translation` }] }
  },
})

type MemberRow = Awaited<ReturnType<typeof listOrganizationMembersFn>>[number]
type InvitationRow = Awaited<ReturnType<typeof listOrganizationInvitationsFn>>[number]

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value))
}

function UsersPage() {
  const { orgSlug } = Route.useParams()
  const pageContext = useSuspenseQuery(organizationUsersPageContextQueryOptions(orgSlug)).data
  const members = useSuspenseQuery(organizationMembersQueryOptions(orgSlug)).data

  const memberColumns: ColumnDef<MemberRow>[] = useMemo(
    () => [
      {
        accessorKey: "userName",
        header: () => <T>Name</T>,
        cell: ({ row }) => <div className="font-medium">{row.original.userName || row.original.userEmail}</div>,
      },
      {
        accessorKey: "userEmail",
        header: () => <T>Email</T>,
        cell: ({ row }) => <div className="text-muted-foreground">{row.original.userEmail}</div>,
      },
      {
        accessorKey: "role",
        header: () => <T>Role</T>,
        cell: ({ row }) => (
          <Badge variant={row.original.role === "owner" ? "default" : "secondary"}>
            {getOrganizationRoleLabel(row.original.role)}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: () => <T>Joined</T>,
        cell: ({ row }) => <div className="text-muted-foreground">{formatDate(row.original.createdAt)}</div>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          pageContext.canManageMembers && (
            <MemberActions
              currentMemberRole={pageContext.currentMemberRole}
              currentUserId={pageContext.currentUserId}
              member={row.original}
            />
          ),
      },
    ],
    [pageContext],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Users</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Manage organization members and invitations.</T>
        </p>
      </div>
      <Card>
        <CardContent>
          <Tabs defaultValue="members">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="members">
                  <T>Members</T>
                </TabsTrigger>
                <TabsTrigger value="invites">
                  <T>Invites</T>
                </TabsTrigger>
              </TabsList>

              {pageContext.canInviteMembers && <InviteUsersDialog />}
            </div>

            <TabsContent value="members">
              <DataTable columns={memberColumns} data={members} />
            </TabsContent>
            <TabsContent value="invites">
              <InvitesList canInviteMembers={pageContext.canInviteMembers} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function InviteUsersDialog() {
  const { orgSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const [open, setOpen] = useState(false)
  const t = useT()

  const inviteMembers = useMutation({
    mutationFn: inviteOrganizationMembersFn,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries(organizationInvitationsQueryOptions(orgSlug))
      setOpen(false)
      form.reset()
      toast.success(variables.data.invites.length === 1 ? t("Invitation sent") : t("Invitations sent"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not send invitations"))
    },
  })

  const form = useAppForm({
    defaultValues: {
      invites: [{ email: "", role: "viewer" as ManageableOrganizationRole }],
    },
    validators: [
      {
        run: ({ value }) => {
          if (value.invites.length === 0) return t("Add at least one invite")

          for (const invite of value.invites) {
            const parsedEmail = z.email().trim().toLowerCase().safeParse(invite.email)
            if (!parsedEmail.success) return t("Each invite must have a valid email")
          }

          return undefined
        },
        triggers: [],
      },
    ],
    onSubmit: ({ value }) => {
      inviteMembers.mutate({
        data: {
          orgSlug,
          invites: value.invites.map((invite) => ({
            email: invite.email.trim().toLowerCase(),
            role: invite.role as ManageableOrganizationRole,
          })),
        },
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button render={<DialogTrigger />}>
        <PlusIcon />
        <T>Invite users</T>
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <T>Invite users</T>
          </DialogTitle>
          <DialogDescription>
            <T>Add one or more people and choose a role for each invite.</T>
          </DialogDescription>
        </DialogHeader>

        <form.AppForm>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.ArrayField name="invites">
              {(array) => (
                <div className="space-y-3">
                  {array.value.map((_, index) => (
                    <div key={index} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                      <form.Field name={`invites[${index}].email`}>
                        {(emailField) => (
                          <Input
                            type="email"
                            placeholder="person@company.com"
                            value={emailField.value}
                            onBlur={emailField.handleBlur}
                            onChange={(event) => emailField.handleChange(event.target.value)}
                            className="min-w-0 flex-1"
                          />
                        )}
                      </form.Field>

                      <form.Field name={`invites[${index}].role`}>
                        {(roleField) => (
                          <Select
                            value={roleField.value}
                            onValueChange={(value) => roleField.handleChange(value as ManageableOrganizationRole)}
                            items={MANAGEABLE_ORGANIZATION_ROLE_OPTIONS}
                          >
                            <SelectTrigger className="w-full sm:w-56">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {MANAGEABLE_ORGANIZATION_ROLE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      </form.Field>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        disabled={array.value.length === 1}
                        onClick={() => array.removeValue(index)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" onClick={() => array.pushValue({ email: "", role: "viewer" })}>
                      <PlusIcon />
                      <T>Add another</T>
                    </Button>
                    <form.FormError>{array.errors[0]?.message}</form.FormError>
                  </div>
                </div>
              )}
            </form.ArrayField>

            <DialogFooter showCloseButton>
              <form.SubmitButton disabled={inviteMembers.isPending}>
                {() => (inviteMembers.isPending ? <T>Sending...</T> : <T>Send invites</T>)}
              </form.SubmitButton>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}

function MemberActions({
  currentMemberRole,
  currentUserId,
  member,
}: {
  currentMemberRole: OrganizationRole
  currentUserId: string
  member: MemberRow
}) {
  const { orgSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const [isChangeRoleDialogOpen, setIsChangeRoleDialogOpen] = useState(false)
  const [isChangeRoleConfirmOpen, setIsChangeRoleConfirmOpen] = useState(false)
  const [isMakeOwnerConfirmOpen, setIsMakeOwnerConfirmOpen] = useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<ManageableOrganizationRole>(
    member.role === "owner" ? "admin" : (member.role as ManageableOrganizationRole),
  )
  const t = useT()

  const updateRole = useMutation({
    mutationFn: updateOrganizationMemberRoleFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(organizationMembersQueryOptions(orgSlug))
      setIsChangeRoleDialogOpen(false)
      setIsChangeRoleConfirmOpen(false)
      setIsMakeOwnerConfirmOpen(false)
      toast.success(t("Role updated"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not update role"))
    },
  })

  const removeMember = useMutation({
    mutationFn: removeOrganizationMemberFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(organizationMembersQueryOptions(orgSlug))
      setIsRemoveConfirmOpen(false)
      toast.success(t("Member removed"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not remove member"))
    },
  })

  const canMakeOwner = currentMemberRole === "owner" && member.role !== "owner"
  const canRemove = member.userId !== currentUserId && member.role !== "owner"
  const canChangeRole = member.role !== "owner"
  const isSavingSelectedRole = updateRole.isPending && isChangeRoleConfirmOpen
  const isMakingOwner = updateRole.isPending && isMakeOwnerConfirmOpen

  function handleChangeRoleDialogChange(nextOpen: boolean) {
    setIsChangeRoleDialogOpen(nextOpen)
    if (!nextOpen) {
      setIsChangeRoleConfirmOpen(false)
      setSelectedRole(member.role === "owner" ? "admin" : (member.role as ManageableOrganizationRole))
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <Button variant="ghost" size="icon" className="size-8" render={<DropdownMenuTrigger />}>
            <MoreVerticalIcon />
          </Button>
          <DropdownMenuContent align="end" className="w-auto min-w-max">
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={!canChangeRole}
              onClick={() => setIsChangeRoleDialogOpen(true)}
            >
              <ShieldIcon />
              <T>Change role</T>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={!canMakeOwner}
              onClick={() => setIsMakeOwnerConfirmOpen(true)}
            >
              <CrownIcon />
              <T>Make owner</T>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={!canRemove}
              variant="destructive"
              onClick={() => setIsRemoveConfirmOpen(true)}
            >
              <Trash2Icon />
              <T>Remove</T>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isChangeRoleDialogOpen} onOpenChange={handleChangeRoleDialogChange}>
        <DialogContent showCloseButton={!updateRole.isPending}>
          <DialogHeader>
            <DialogTitle>
              <T>Change role</T>
            </DialogTitle>
            <DialogDescription>
              <T context="change-member-role-description">Select a new role for this member.</T>
            </DialogDescription>
          </DialogHeader>

          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as ManageableOrganizationRole)}
            items={MANAGEABLE_ORGANIZATION_ROLE_OPTIONS}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {MANAGEABLE_ORGANIZATION_ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{getOrganizationRoleLabel(selectedRole)}</div>
            <div className="text-muted-foreground">{getOrganizationRoleDescription(selectedRole)}</div>
          </div>

          <DialogFooter showCloseButton={!updateRole.isPending}>
            <Button
              disabled={updateRole.isPending || selectedRole === member.role}
              onClick={() => setIsChangeRoleConfirmOpen(true)}
            >
              <T>Save</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isChangeRoleConfirmOpen} onOpenChange={setIsChangeRoleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>Confirm role change</T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T context="confirm-role-change-description">Change this member to the selected role?</T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingSelectedRole}>
              <T>Cancel</T>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSavingSelectedRole}
              onClick={() => updateRole.mutate({ data: { orgSlug, memberId: member.id, role: selectedRole } })}
            >
              <T>Save</T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isMakeOwnerConfirmOpen} onOpenChange={setIsMakeOwnerConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>Make owner</T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T context="make-owner-description">Transfer ownership to this member?</T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMakingOwner}>
              <T>Cancel</T>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isMakingOwner}
              onClick={() => updateRole.mutate({ data: { orgSlug, memberId: member.id, role: "owner" } })}
            >
              <T>Make owner</T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>Remove member</T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T context="remove-member-description">
                Remove this member from the organization? They will lose access immediately.
              </T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <T>Cancel</T>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMember.isPending}
              variant="destructive"
              onClick={() => removeMember.mutate({ data: { orgSlug, memberId: member.id } })}
            >
              <T>Remove</T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InvitationActions({ invitation }: { invitation: InvitationRow }) {
  const { orgSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const [open, setOpen] = useState(false)
  const t = useT()

  const cancelInvitation = useMutation({
    mutationFn: cancelOrganizationInvitationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries(organizationInvitationsQueryOptions(orgSlug))
      setOpen(false)
      toast.success(t("Invitation canceled"))
    },
    onError: (error) => {
      toast.error(error.message || t("Could not cancel invitation"))
    },
  })

  const canCancel = invitation.status === "pending"

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <Button variant="ghost" size="icon" className="size-8" render={<DropdownMenuTrigger />}>
            <MoreVerticalIcon />
          </Button>
          <DropdownMenuContent align="end" className="w-auto min-w-max">
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={!canCancel}
              variant="destructive"
              onClick={() => setOpen(true)}
            >
              <Trash2Icon />
              <T>Cancel invitation</T>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>Cancel invitation</T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T context="cancel-invitation-description">
                Cancel this invitation? The recipient can no longer use the existing invite.
              </T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <T>Keep invitation</T>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelInvitation.isPending}
              onClick={() => cancelInvitation.mutate({ data: { orgSlug, invitationId: invitation.id } })}
            >
              <T>Cancel invitation</T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InvitesList({ canInviteMembers }: { canInviteMembers: boolean }) {
  const { orgSlug } = Route.useParams()
  const { data: invitations, isPending } = useQuery(organizationInvitationsQueryOptions(orgSlug))

  const invitationColumns: ColumnDef<InvitationRow>[] = useMemo(
    () => [
      {
        accessorKey: "email",
        header: () => <T>Email</T>,
        cell: ({ row }) => <div className="font-medium">{row.original.email}</div>,
      },
      {
        accessorKey: "role",
        header: () => <T>Role</T>,
        cell: ({ row }) => <Badge variant="outline">{getOrganizationRoleLabel(row.original.role || "viewer")}</Badge>,
      },
      {
        accessorKey: "inviter",
        header: () => <T>Invited by</T>,
        cell: ({ row }) => (
          <div className="text-muted-foreground">{row.original.inviter?.name || row.original.inviter?.email || "Unknown"}</div>
        ),
      },
      {
        accessorKey: "status",
        header: () => <T>Status</T>,
        cell: ({ row }) => (
          <Badge variant={getInvitationStatusBadgeVariant(row.original.status)}>
            {getInvitationStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "expiresAt",
        header: () => <T>Expires</T>,
        cell: ({ row }) => <div className="text-muted-foreground">{formatDate(row.original.expiresAt)}</div>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => canInviteMembers && <InvitationActions invitation={row.original} />,
      },
    ],
    [canInviteMembers],
  )

  return <DataTable columns={invitationColumns} data={invitations} isLoading={isPending} />
}
