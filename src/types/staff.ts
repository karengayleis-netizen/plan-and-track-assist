/**
 * Staff Directory Types
 * Collection: teachers (docId = Firebase UID)
 */

export interface StaffMember {
  uid: string;
  email: string;
  emailLower: string;
  schoolId: string;
  role: 'teacher' | 'admin';
  canWrite: boolean;
  assignedHomerooms: string[];
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffInput {
  uid: string;
  email: string;
  role?: 'teacher' | 'admin';
  canWrite?: boolean;
  assignedHomerooms?: string[];
  displayName?: string;
}

export interface UpdateStaffInput {
  role?: 'teacher' | 'admin';
  canWrite?: boolean;
  assignedHomerooms?: string[];
  displayName?: string;
}

export interface StaffSearchResult {
  uid: string;
  email: string;
  displayName?: string;
}
