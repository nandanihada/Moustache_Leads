import api from './api';

export interface SubadminPermission {
    user_id: string;
    username: string;
    email: string;
    role: string;
    allowed_tabs: string[];
    created_at: string;
    updated_at: string;
}

export interface User {
    _id: string;
    username: string;
    email: string;
    role: string;
    created_at: string;
}

export interface AvailableTab {
    value: string;
    label: string;
}

export interface MyPermissions {
    role: string;
    allowed_tabs: string[];
    has_full_access: boolean;
}

const subadminService = {
    /**
     * Get all users for selection dropdown
     */
    async getUsers(): Promise<{ users: User[]; total: number }> {
        const response = await api.get('/admin/subadmins/users');
        return response.data;
    },

    /**
     * Get all available admin tabs for permission selection
     */
    async getAvailableTabs(): Promise<{ tabs: AvailableTab[] }> {
        const response = await api.get('/admin/subadmins/available-tabs');
        return response.data;
    },

    /**
     * Get all subadmins with their permissions
     */
    async getAllSubadmins(): Promise<{ subadmins: SubadminPermission[]; total: number }> {
        const response = await api.get('/admin/subadmins');
        return response.data;
    },

    /**
     * Create or update subadmin with permissions
     */
    async createOrUpdateSubadmin(userId: string, allowedTabs: string[]): Promise<any> {
        const response = await api.post('/admin/subadmins', {
            user_id: userId,
            allowed_tabs: allowedTabs
        });
        return response.data;
    },

    /**
     * Get permissions for a specific subadmin
     */
    async getSubadminPermissions(userId: string): Promise<SubadminPermission> {
        const response = await api.get(`/admin/subadmins/${userId}`);
        return response.data;
    },

    /**
     * Remove subadmin role and permissions
     */
    async removeSubadmin(userId: string): Promise<any> {
        const response = await api.delete(`/admin/subadmins/${userId}`);
        return response.data;
    },

    /**
     * Get current user's permissions (for subadmins to check their own permissions)
     */
    async getMyPermissions(): Promise<MyPermissions> {
        const response = await api.get('/admin/subadmins/my-permissions');
        return response.data;
    }
};

export default subadminService;
