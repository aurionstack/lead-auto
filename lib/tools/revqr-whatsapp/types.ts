export type RevQrCampaignStatus = 'paused' | 'active' | 'completed';
export type RevQrProspectStatus = 'new' | 'qualified' | 'contacted' | 'replied' | 'demo_sent' | 'interested' | 'payment_sent' | 'customer' | 'not_interested' | 'no_response' | 'do_not_contact';
export type RevQrIntent = 'stop' | 'pricing' | 'demo' | 'interested' | 'payment' | 'onboarding' | 'other';

export interface RevQrCampaign {
  id: string;
  organization_id: string;
  name: string;
  status: RevQrCampaignStatus;
  phone_number_id: string;
  daily_limit: number;
  follow_up_delay_hours: number;
  demo_url: string;
  payment_url: string;
  website_url: string;
  offer_text: string;
  follow_up_template_name: string | null;
  template_language: string;
  created_at: string;
  updated_at: string;
}

export interface RevQrDashboardData {
  databaseReady: boolean;
  active: boolean;
  campaign: RevQrCampaign | null;
  metrics: {
    prospects: number;
    openConversations: number;
    replies: number;
    demoSent: number;
    interested: number;
    paymentSent: number;
    customers: number;
    pendingJobs: number;
    failedJobs: number;
  };
  recentProspects: Array<{ id: string; business_name: string | null; phone_e164: string; status: RevQrProspectStatus; updated_at: string }>;
}
