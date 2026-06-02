export type InvitationStatus = "pending" | "accepted" | "rejected" | "canceled"

export const INVITATION_STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  canceled: "Canceled",
} satisfies Record<InvitationStatus, string>

export function getInvitationStatusLabel(status: string) {
  if (isInvitationStatus(status)) return INVITATION_STATUS_LABELS[status]
  return status
}

export const INVITATION_STATUS_BADGE_VARIANTS = {
  pending: "outline",
  accepted: "default",
  rejected: "destructive",
  canceled: "destructive",
} satisfies Record<InvitationStatus, "default" | "secondary" | "outline" | "destructive">

export function getInvitationStatusBadgeVariant(status: string) {
  if (isInvitationStatus(status)) return INVITATION_STATUS_BADGE_VARIANTS[status]
  return "outline"
}

function isInvitationStatus(status: string): status is InvitationStatus {
  return status in INVITATION_STATUS_LABELS
}
