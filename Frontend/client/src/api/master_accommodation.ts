import { apiClient } from './client';

export const accommodationAPI = {
    // ---- Guest House APIs ----
    guestHouse: {
        get: async (id: number) => {
            const { data } = await apiClient.get(`/master/guest-houses/${id}/`);
            return data;
        },
        // getAll: async () => {
        //     const { data } = await apiClient.get('/master/guest-houses/');
        //     return data;
        // },
        getAll: (search = '') => {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            return apiClient.get(`/master/guest-houses/${params}`);
        },
        create: async (payload: any) => {
            const { data } = await apiClient.post('/master/guest-houses/', payload);
            return data;
        },
        update: async (id: number, payload: any) => {
            const { data } = await apiClient.put(`/master/guest-houses/${id}/`, payload);
            return data;
        },
        // delete: async (id: number) => {
        //     const { data } = await apiClient.delete(`/master/guest-houses/${id}/`);
        //     return data;
        // },
        toggleActive: (id, isActive) => {
            if (isActive) {
                return apiClient.post(`/master/guest-houses/${id}/activate/`);
            } else {
                return apiClient.delete(`/master/guest-houses/${id}/`);
            }
        },
        delete: (id) => apiClient.delete(`/master/guest-houses/${id}/`, { params: { hard_delete: true } }),

        // getAll: (search = '', filters = {}) => {
        //     const params = new URLSearchParams();
        //     if (search) params.append('search', search);
        //     Object.keys(filters).forEach(key => {
        //         if (filters[key]) params.append(key, filters[key]);
        //     });
        //     return apiClient.get(`/guest-houses/?${params.toString()}`);
        // },
    },
    arcHotel: {
        getAll: (search = '', page = 1, pageSize = 10) => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('page', page.toString());
            params.append('page_size', pageSize.toString());
            return apiClient.get(`/master/arc-hotels/?${params.toString()}`);
        },
        get: (id) => apiClient.get(`/master/arc-hotels/${id}/`),
        create: (data) => apiClient.post('/master/arc-hotels/', data),
        update: (id, data) => apiClient.put(`/master/arc-hotels/${id}/`, data),
        toggleActive: (id, shouldActivate) => {
            if (shouldActivate) {
                return apiClient.patch(`/master/arc-hotels/${id}/`, { is_active: true });
            } else {
                return apiClient.delete(`/master/arc-hotels/${id}/`);
            }
        },
        delete: (id) => apiClient.delete(`/master/arc-hotels/${id}/`, { params: { hard_delete: true } }),
    }
};
