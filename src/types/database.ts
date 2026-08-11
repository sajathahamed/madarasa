export type UserRole =
  | "super_admin"
  | "vendor_admin"
  | "data_entry"
  | "accountant"
  | "principal";

export type ApprovalStatus =
  | "pending_accountant"
  | "pending_principal"
  | "approved"
  | "rejected";

export type PaymentMethod = "cash" | "bank_transfer" | "card" | "online";
export type DonationType = "cash" | "bank_transfer";
export type AttendanceStatus = "present" | "absent" | "late";
export type IslamicStream = "qaida" | "nazirah" | "hifz";
export type HifzComponent = "sabaq" | "sabqi" | "manzil" | "juz";
export type StudentStatus = "active" | "left" | "graduated";
export type AcademicSection = "hifz" | "sariya";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Tables = {
  vendors: {
    Row: {
      id: string;
      name: string;
      address: string | null;
      contact_phone: string | null;
      whatsapp_number: string;
      status: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      address?: string | null;
      contact_phone?: string | null;
      whatsapp_number: string;
      status?: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      address?: string | null;
      contact_phone?: string | null;
      whatsapp_number?: string;
      status?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  branches: {
    Row: {
      id: string;
      vendor_id: string;
      name: string;
      address: string | null;
      contact_phone: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      name: string;
      address?: string | null;
      contact_phone?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      name?: string;
      address?: string | null;
      contact_phone?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  app_users: {
    Row: {
      id: string;
      vendor_id: string | null;
      branch_id: string | null;
      role: UserRole;
      full_name: string;
      phone: string | null;
      whatsapp_number: string | null;
      status: string;
      created_at: string;
    };
    Insert: {
      id: string;
      vendor_id?: string | null;
      branch_id?: string | null;
      role: UserRole;
      full_name: string;
      phone?: string | null;
      whatsapp_number?: string | null;
      status?: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string | null;
      branch_id?: string | null;
      role?: UserRole;
      full_name?: string;
      phone?: string | null;
      whatsapp_number?: string | null;
      status?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  students: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      admission_no: string;
      full_name: string;
      dob: string | null;
      gender: string | null;
      guardian_name: string;
      guardian_phone: string;
      address: string | null;
      photo_url: string | null;
      admission_date: string;
      status: string;
      created_by: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      admission_no: string;
      full_name: string;
      dob?: string | null;
      gender?: string | null;
      guardian_name: string;
      guardian_phone: string;
      address?: string | null;
      photo_url?: string | null;
      admission_date?: string;
      status?: string;
      created_by?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      admission_no?: string;
      full_name?: string;
      dob?: string | null;
      gender?: string | null;
      guardian_name?: string;
      guardian_phone?: string;
      address?: string | null;
      photo_url?: string | null;
      admission_date?: string;
      status?: string;
      created_by?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  student_health_info: {
    Row: {
      student_id: string;
      blood_group: string | null;
      allergies: string | null;
      medical_conditions: string | null;
      current_medications: string | null;
      emergency_contact_name: string | null;
      emergency_contact_phone: string | null;
      notes: string | null;
      updated_at: string;
    };
    Insert: {
      student_id: string;
      blood_group?: string | null;
      allergies?: string | null;
      medical_conditions?: string | null;
      current_medications?: string | null;
      emergency_contact_name?: string | null;
      emergency_contact_phone?: string | null;
      notes?: string | null;
      updated_at?: string;
    };
    Update: {
      student_id?: string;
      blood_group?: string | null;
      allergies?: string | null;
      medical_conditions?: string | null;
      current_medications?: string | null;
      emergency_contact_name?: string | null;
      emergency_contact_phone?: string | null;
      notes?: string | null;
      updated_at?: string;
    };
    Relationships: [];
  };
  student_fee_plans: {
    Row: {
      id: string;
      student_id: string;
      monthly_amount: number;
      is_free: boolean;
      discount_percent: number;
      effective_from: string;
      is_current: boolean;
    };
    Insert: {
      id?: string;
      student_id: string;
      monthly_amount?: number;
      is_free?: boolean;
      discount_percent?: number;
      effective_from?: string;
      is_current?: boolean;
    };
    Update: {
      id?: string;
      student_id?: string;
      monthly_amount?: number;
      is_free?: boolean;
      discount_percent?: number;
      effective_from?: string;
      is_current?: boolean;
    };
    Relationships: [];
  };
  fee_dues: {
    Row: {
      id: string;
      student_id: string;
      vendor_id: string;
      branch_id: string;
      due_month: number;
      due_year: number;
      month_amount: number;
      carried_forward: number;
      total_due: number;
      amount_paid: number;
      status: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      student_id: string;
      vendor_id: string;
      branch_id: string;
      due_month: number;
      due_year: number;
      month_amount?: number;
      carried_forward?: number;
      total_due?: number;
      amount_paid?: number;
      status?: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      student_id?: string;
      vendor_id?: string;
      branch_id?: string;
      due_month?: number;
      due_year?: number;
      month_amount?: number;
      carried_forward?: number;
      total_due?: number;
      amount_paid?: number;
      status?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  payments: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      student_id: string;
      fee_due_id: string | null;
      amount: number;
      method: PaymentMethod;
      bank_reference: string | null;
      recorded_by: string;
      status: ApprovalStatus;
      accountant_id: string | null;
      accountant_action_at: string | null;
      accountant_remarks: string | null;
      principal_id: string | null;
      principal_action_at: string | null;
      principal_remarks: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      student_id: string;
      fee_due_id?: string | null;
      amount: number;
      method: PaymentMethod;
      bank_reference?: string | null;
      recorded_by: string;
      status?: ApprovalStatus;
      accountant_id?: string | null;
      accountant_action_at?: string | null;
      accountant_remarks?: string | null;
      principal_id?: string | null;
      principal_action_at?: string | null;
      principal_remarks?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      student_id?: string;
      fee_due_id?: string | null;
      amount?: number;
      method?: PaymentMethod;
      bank_reference?: string | null;
      recorded_by?: string;
      status?: ApprovalStatus;
      accountant_id?: string | null;
      accountant_action_at?: string | null;
      accountant_remarks?: string | null;
      principal_id?: string | null;
      principal_action_at?: string | null;
      principal_remarks?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  donations: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      donor_name: string;
      donor_phone: string | null;
      amount: number;
      type: DonationType;
      bank_reference: string | null;
      notes: string | null;
      received_by: string;
      status: ApprovalStatus;
      accountant_id: string | null;
      accountant_action_at: string | null;
      accountant_remarks: string | null;
      principal_id: string | null;
      principal_action_at: string | null;
      principal_remarks: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      donor_name: string;
      donor_phone?: string | null;
      amount: number;
      type: DonationType;
      bank_reference?: string | null;
      notes?: string | null;
      received_by: string;
      status?: ApprovalStatus;
      accountant_id?: string | null;
      accountant_action_at?: string | null;
      accountant_remarks?: string | null;
      principal_id?: string | null;
      principal_action_at?: string | null;
      principal_remarks?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      donor_name?: string;
      donor_phone?: string | null;
      amount?: number;
      type?: DonationType;
      bank_reference?: string | null;
      notes?: string | null;
      received_by?: string;
      status?: ApprovalStatus;
      accountant_id?: string | null;
      accountant_action_at?: string | null;
      accountant_remarks?: string | null;
      principal_id?: string | null;
      principal_action_at?: string | null;
      principal_remarks?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  accounts: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string | null;
      name: string;
      type: string;
      opening_balance: number;
      current_balance: number;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id?: string | null;
      name: string;
      type: string;
      opening_balance?: number;
      current_balance?: number;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string | null;
      name?: string;
      type?: string;
      opening_balance?: number;
      current_balance?: number;
    };
    Relationships: [];
  };
  ledger_entries: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      txn_group_id: string;
      source_table: string;
      source_id: string;
      account_id: string;
      entry_type: string;
      amount: number;
      entry_date: string;
      created_by: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      txn_group_id: string;
      source_table: string;
      source_id: string;
      account_id: string;
      entry_type: string;
      amount: number;
      entry_date?: string;
      created_by?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      txn_group_id?: string;
      source_table?: string;
      source_id?: string;
      account_id?: string;
      entry_type?: string;
      amount?: number;
      entry_date?: string;
      created_by?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  whatsapp_messages: {
    Row: {
      id: string;
      vendor_id: string | null;
      student_id: string | null;
      recipient_phone: string;
      message_type: string;
      template_name: string | null;
      status: string;
      provider_response: Json | null;
      sent_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id?: string | null;
      student_id?: string | null;
      recipient_phone: string;
      message_type: string;
      template_name?: string | null;
      status?: string;
      provider_response?: Json | null;
      sent_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string | null;
      student_id?: string | null;
      recipient_phone?: string;
      message_type?: string;
      template_name?: string | null;
      status?: string;
      provider_response?: Json | null;
      sent_at?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  audit_logs: {
    Row: {
      id: string;
      vendor_id: string | null;
      user_id: string | null;
      action: string;
      table_name: string;
      record_id: string | null;
      old_data: Json | null;
      new_data: Json | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id?: string | null;
      user_id?: string | null;
      action: string;
      table_name: string;
      record_id?: string | null;
      old_data?: Json | null;
      new_data?: Json | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string | null;
      user_id?: string | null;
      action?: string;
      table_name?: string;
      record_id?: string | null;
      old_data?: Json | null;
      new_data?: Json | null;
      created_at?: string;
    };
    Relationships: [];
  };
  academic_years: {
    Row: {
      id: string;
      vendor_id: string;
      name: string;
      starts_on: string;
      ends_on: string;
      is_current: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      name: string;
      starts_on: string;
      ends_on: string;
      is_current?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      name?: string;
      starts_on?: string;
      ends_on?: string;
      is_current?: boolean;
      created_at?: string;
    };
    Relationships: [];
  };
  classes: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      academic_year_id: string | null;
      name: string;
      section: AcademicSection | null;
      grade: number | null;
      teacher_id: string | null;
      schedule_note: string | null;
      is_active: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      academic_year_id?: string | null;
      name: string;
      section?: AcademicSection | null;
      grade?: number | null;
      teacher_id?: string | null;
      schedule_note?: string | null;
      is_active?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      academic_year_id?: string | null;
      name?: string;
      section?: AcademicSection | null;
      grade?: number | null;
      teacher_id?: string | null;
      schedule_note?: string | null;
      is_active?: boolean;
      created_at?: string;
    };
    Relationships: [];
  };
  class_enrollments: {
    Row: {
      id: string;
      class_id: string;
      student_id: string;
      enrolled_at: string;
      left_at: string | null;
      is_active: boolean;
    };
    Insert: {
      id?: string;
      class_id: string;
      student_id: string;
      enrolled_at?: string;
      left_at?: string | null;
      is_active?: boolean;
    };
    Update: {
      id?: string;
      class_id?: string;
      student_id?: string;
      enrolled_at?: string;
      left_at?: string | null;
      is_active?: boolean;
    };
    Relationships: [];
  };
  attendance_sessions: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      class_id: string;
      session_date: string;
      marked_by: string | null;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      class_id: string;
      session_date: string;
      marked_by?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      class_id?: string;
      session_date?: string;
      marked_by?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  attendance_records: {
    Row: {
      id: string;
      session_id: string;
      student_id: string;
      status: AttendanceStatus;
      note: string | null;
    };
    Insert: {
      id?: string;
      session_id: string;
      student_id: string;
      status?: AttendanceStatus;
      note?: string | null;
    };
    Update: {
      id?: string;
      session_id?: string;
      student_id?: string;
      status?: AttendanceStatus;
      note?: string | null;
    };
    Relationships: [];
  };
  islamic_progress_logs: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      student_id: string;
      class_id: string | null;
      stream: IslamicStream;
      hifz_component: HifzComponent | null;
      lesson_label: string;
      pages_or_ayah: string | null;
      quality_note: string | null;
      logged_by: string | null;
      logged_on: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      student_id: string;
      class_id?: string | null;
      stream: IslamicStream;
      hifz_component?: HifzComponent | null;
      lesson_label: string;
      pages_or_ayah?: string | null;
      quality_note?: string | null;
      logged_by?: string | null;
      logged_on?: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      student_id?: string;
      class_id?: string | null;
      stream?: IslamicStream;
      hifz_component?: HifzComponent | null;
      lesson_label?: string;
      pages_or_ayah?: string | null;
      quality_note?: string | null;
      logged_by?: string | null;
      logged_on?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  parent_access_tokens: {
    Row: {
      id: string;
      student_id: string;
      vendor_id: string;
      token_hash: string;
      label: string | null;
      expires_at: string | null;
      last_used_at: string | null;
      created_by: string | null;
      created_at: string;
      revoked_at: string | null;
    };
    Insert: {
      id?: string;
      student_id: string;
      vendor_id: string;
      token_hash: string;
      label?: string | null;
      expires_at?: string | null;
      last_used_at?: string | null;
      created_by?: string | null;
      created_at?: string;
      revoked_at?: string | null;
    };
    Update: {
      id?: string;
      student_id?: string;
      vendor_id?: string;
      token_hash?: string;
      label?: string | null;
      expires_at?: string | null;
      last_used_at?: string | null;
      created_by?: string | null;
      created_at?: string;
      revoked_at?: string | null;
    };
    Relationships: [];
  };
  library_book_types: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      name: string;
      created_by: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      name: string;
      created_by?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      name?: string;
      created_by?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  library_books: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      title: string;
      qitab_id: string;
      author: string | null;
      type_id: string | null;
      copies_total: number;
      notes: string | null;
      is_active: boolean;
      created_by: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      title: string;
      qitab_id: string;
      author?: string | null;
      type_id?: string | null;
      copies_total?: number;
      notes?: string | null;
      is_active?: boolean;
      created_by?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      title?: string;
      qitab_id?: string;
      author?: string | null;
      type_id?: string | null;
      copies_total?: number;
      notes?: string | null;
      is_active?: boolean;
      created_by?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  library_loans: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      book_id: string;
      student_id: string | null;
      staff_id: string | null;
      borrowed_at: string;
      due_at: string | null;
      returned_at: string | null;
      borrowed_by: string | null;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      book_id: string;
      student_id?: string | null;
      staff_id?: string | null;
      borrowed_at?: string;
      due_at?: string | null;
      returned_at?: string | null;
      borrowed_by?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      book_id?: string;
      student_id?: string | null;
      staff_id?: string | null;
      borrowed_at?: string;
      due_at?: string | null;
      returned_at?: string | null;
      borrowed_by?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  staff_members: {
    Row: {
      id: string;
      vendor_id: string;
      branch_id: string;
      full_name: string;
      staff_code: string | null;
      phone: string | null;
      email: string | null;
      role_title: string | null;
      address: string | null;
      status: "active" | "left";
      notes: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      vendor_id: string;
      branch_id: string;
      full_name: string;
      staff_code?: string | null;
      phone?: string | null;
      email?: string | null;
      role_title?: string | null;
      address?: string | null;
      status?: "active" | "left";
      notes?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      vendor_id?: string;
      branch_id?: string;
      full_name?: string;
      staff_code?: string | null;
      phone?: string | null;
      email?: string | null;
      role_title?: string | null;
      address?: string | null;
      status?: "active" | "left";
      notes?: string | null;
      created_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  password_reset_otps: {
    Row: {
      id: string;
      user_id: string;
      email: string;
      phone: string;
      code_hash: string;
      attempts: number;
      max_attempts: number;
      expires_at: string;
      verified_at: string | null;
      consumed_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      email: string;
      phone: string;
      code_hash: string;
      attempts?: number;
      max_attempts?: number;
      expires_at: string;
      verified_at?: string | null;
      consumed_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      email?: string;
      phone?: string;
      code_hash?: string;
      attempts?: number;
      max_attempts?: number;
      expires_at?: string;
      verified_at?: string | null;
      consumed_at?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      generate_monthly_fee_dues: {
        Args: { p_month?: number; p_year?: number };
        Returns: number;
      };
      lookup_auth_user_by_email: {
        Args: { p_email: string };
        Returns: { id: string; email: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      approval_status: ApprovalStatus;
      payment_method: PaymentMethod;
      donation_type: DonationType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type AppUser = Tables["app_users"]["Row"];
export type Vendor = Tables["vendors"]["Row"];
export type Branch = Tables["branches"]["Row"];
export type Student = Tables["students"]["Row"];
export type Payment = Tables["payments"]["Row"];
export type Donation = Tables["donations"]["Row"];
export type SchoolClass = Tables["classes"]["Row"];
export type FeeDue = Tables["fee_dues"]["Row"];
export type IslamicProgressLog = Tables["islamic_progress_logs"]["Row"];
export type LibraryBook = Tables["library_books"]["Row"];
export type LibraryBookType = Tables["library_book_types"]["Row"];
export type LibraryLoan = Tables["library_loans"]["Row"];
export type StaffMember = Tables["staff_members"]["Row"];
