import { useLocalStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { useOptionsStore } from '@/stores/options';
import { computed } from 'vue';

export const useUserStore = defineStore("user", () => {

    const apikeyDB = useLocalStorage("apikeyDB", "0000000000");
    const apiKeyAA = useLocalStorage("apikeyAA", "0000000000");
    const apiKey = computed({
        get() {
            if (useOptionsStore().useAIEUHorde === 'Enabled') {
                return apiKeyAA.value;
            } else {
                return apikeyDB.value;
            }
        },
        set(newApiKey) {
            if (useOptionsStore().useAIEUHorde === 'Enabled') {
                apiKeyAA.value = newApiKey;
            } else {
                apikeyDB.value = newApiKey;
            }
        }
    })
    
    function setAnon() {
        if (useOptionsStore().useAIEUHorde === 'Enabled') {
            apiKeyAA.value = "0000000000";
        } else {
            apikeyDB.value = "0000000000";
        }
    }

    return {
        apiKey,
        apikeyDB,
        apiKeyAA,

        setAnon
    }
});