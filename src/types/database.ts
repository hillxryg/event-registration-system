export type UserRole = 'guest' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string;
  venue: string;
  scanner_pin?: string;
  is_active: boolean;
  created_at: string;
}

export interface Attendee {
  id: string;
  event_id: string;
  ticket_code: string;
  full_name: string;
  email: string;
  organization: string;
  contact_number: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

export type CheckInStatus = 'valid' | 'already_checked_in' | 'invalid' | 'unauthorized';

export interface CheckInResponse {
  status: CheckInStatus;
  message?: string;
  checked_in_at?: string;
  attendee?: Attendee;
}