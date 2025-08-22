export interface CreateMerchantRequest {
    type: 'business';
    coc_nr: string; // Chamber of Commerce number
    country: string; // e.g., 'nld' for Netherlands
    emailaddress: string;
    phone?: string;
    notify_url: string; // Webhook URL for status changes
}

export interface CreateMerchantResponse {
    livemode: boolean;
    uid: string;
    object: 'merchant';
    created: number;
    updated: number;
    status: 'pending' | 'live' | 'suspended' | 'terminated' | 'blocked';
    compliance: {
        level: number;
        status: 'unverified' | 'pending' | 'verified';
        overview_url: string;
        requirements: ComplianceRequirement[];
    };
    type: 'business';
    coc_nr: string;
    phone: string;
    country: string;
    notify_url: string;
}

export interface ComplianceRequirement {
    type: string;
    status: 'unverified' | 'pending' | 'verified';
    object_type: string;
    object_uid: string | null;
    object_url: string | null;
    object_redirect_url: string | null;
}

export interface CreateBankAccountRequest {
    return_url: string;
    notify_url: string;
}

export interface OppMerchantUpdateData {
    emailaddress?: string;
    phone?: string;
    country?: string;
    status?: 'pending' | 'live' | 'suspended' | 'terminated' | 'blocked';
}

export interface CreateBankAccountResponse {
    uid: string;
    object: 'bank_account';
    created: number;
    updated: number;
    verified: number | null;
    verification_url: string;
    status: 'new' | 'pending' | 'approved' | 'disapproved';
    account: {
        account_iban: string | null;
    };
    bank: {
        bic: string | null;
    };
    reference: string | null;
    return_url: string;
    notify_url: string;
    is_default: boolean;
}

export interface OppApiError {
    error: {
        type: string;
        message: string;
        code?: string;
    };
}

export interface IOppVerification {
    create_merchant_and_bank: boolean;
    bank_verification: boolean;
    identity_verification: boolean;
    additional_verification: boolean;
    merchant_status: string;
}