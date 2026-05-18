import { defineStore } from 'pinia';
import { getClient } from '~/util/awclient';

export interface CorsConfig {
    cors: string[];
    cors_regex: string[];
    cors_allow_aw_chrome_extension: boolean;
    cors_allow_all_mozilla_extension: boolean;
    in_file: string[];
    needs_restart: boolean;
}

export type MutableCorsConfig = Pick<CorsConfig, 'cors' | 'cors_regex' | 'cors_allow_aw_chrome_extension' | 'cors_allow_all_mozilla_extension'>;

interface State {
    config: CorsConfig | null;
    loading: boolean;
    error: string | null;
}

export const useCorsStore = defineStore('cors', {
    state: (): State => ({
        config: null,
        loading: false,
        error: null,
    }),
    actions: {
        async load() {
            this.loading = true;
            this.error = null;
            try {
                const client = getClient();
                const response = await client.req.get('/0/cors-config');
                this.config = response.data;
            } catch (e: any) {
                this.error = e.response?.data?.message || e.message || 'Failed to load CORS config';
            } finally {
                this.loading = false;
            }
        },
        async save(newConfig: MutableCorsConfig) {
            this.loading = true;
            this.error = null;
            try {
                const client = getClient();
                // Only send the mutable subset to the server
                const payload: MutableCorsConfig = {
                    cors: newConfig.cors,
                    cors_regex: newConfig.cors_regex,
                    cors_allow_aw_chrome_extension: newConfig.cors_allow_aw_chrome_extension,
                    cors_allow_all_mozilla_extension: newConfig.cors_allow_all_mozilla_extension,
                };
                await client.req.post('/0/cors-config', payload);

                // Update local state if successful
                if (this.config) {
                    this.config = { ...this.config, ...payload };
                }
            } catch (e: any) {
                this.error = e.response?.data?.message || e.message || 'Failed to save CORS config';
                throw e;
            } finally {
                this.loading = false;
            }
        }
    }
});
