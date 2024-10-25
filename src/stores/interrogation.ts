import type { RequestInterrogationResponse, ModelInterrogationInputStable, InterrogationStatus } from "@/types/stable_horde";
import { validateResponse } from "@/utils/validate";
import { defineStore } from "pinia";
import { ref } from "vue";
import { useUserStore } from "./user";
import { useUIStore } from "./ui";
import { BASE_URL_AI_STABLE, BASE_URL_EU_STABLE } from "@/constants";
import { useLanguageStore } from '@/stores/i18n';
import { useOptionsStore } from '@/stores/options';

function sleep(ms: number) {
    return new Promise(res=>setTimeout(res, ms));
}

export interface InterrogationInfo {
    status?: InterrogationStatus;
    id?: string;
    source_image?: string;
    forms_selected?: ("nsfw" | "caption" | "interrogation")[];
    elapsed_seconds?: number;
}

interface FormResult {
    [key: string]: Record<string, any> | undefined;
}

export const useInterrogationStore = defineStore("interrogate", () => {
    const settings = useOptionsStore();
    const lang = useLanguageStore();
    const currentInterrogation = ref<InterrogationInfo>({});
    const interrogating = ref(false);
    const possibleForms: ("nsfw" | "caption" | "interrogation")[] = ["nsfw", "caption", "interrogation"];
    const selectedForms = ref<typeof possibleForms>(["nsfw", "caption"]);

    async function onError(msg: string) {
        const uiStore = useUIStore();
        uiStore.raiseError(msg, false);
        interrogating.value = false;
        currentInterrogation.value = {};
    }

    async function interrogateImage() {
        const userStore = useUserStore();
        const { source_image } = currentInterrogation.value;
        const forms = selectedForms.value;
        if (!source_image) return onError(lang.GetText(`intfailedtogetimage`));
        interrogating.value = true;
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/interrogate/async`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/interrogate/async`;
        }    
        const response = await fetch(fetchUri, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                "Client-Agent": "AAAIUI:1.0:Discord Sgt. Chaos#0812",
                apikey: userStore.apiKey,
            },
            body: JSON.stringify(<ModelInterrogationInputStable>{
                source_image: source_image.split(",")[1],
                forms: forms.map(el => ({ name: el })),
            })
        });
        const json: RequestInterrogationResponse = await response.json();
        if (!validateResponse(response, json, 202, lang.GetText(`intfailedtogetid`), onError)) return;
        currentInterrogation.value.id = json.id;
        currentInterrogation.value.forms_selected = forms;
        currentInterrogation.value.elapsed_seconds = 0;
        while (currentInterrogation.value.status?.state !== "done" && interrogating.value) {
            const t0 = performance.now() / 1000;

            await sleep(2000);
            const status = await getInterrogationStatus();
            if (!status) {
                interrogating.value = false;
                currentInterrogation.value = {};
                return;
            }

            const t1 = performance.now() / 1000;
            currentInterrogation.value.elapsed_seconds += t1 - t0;
        }
    }

    async function getInterrogationStatus() {
        interrogating.value = true;
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/interrogate/status/${currentInterrogation.value.id}`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/interrogate/status/${currentInterrogation.value.id}`;
        }    
        const response = await fetch(fetchUri, {
            headers: {
                'Content-Type': 'application/json',
                "Client-Agent": "AAAIUI:1.0:Discord Sgt. Chaos#0812",
            }
        });
        const json: InterrogationStatus = await response.json();
        if (!validateResponse(response, json, 200, lang.GetText(`intfailedtogetstatus`), onError)) return;
        currentInterrogation.value.status = json;
        return json;
    }

    function getFormStatus(formName: string) {
        const form = currentInterrogation.value.status?.forms?.find(el => el.form === formName);
        if (!form) return;
        return {
            ...form,
            result: form.result as FormResult | undefined,
            processing: form.state === 'processing',
        }
    }

    function resetInterrogation() {
        currentInterrogation.value = {};
        interrogating.value = false;
    }

    return {
        // Variables
        currentInterrogation,
        interrogating,
        selectedForms,
        // Constants
        possibleForms,
        // Actions
        interrogateImage,
        getInterrogationStatus,
        getFormStatus,
        resetInterrogation,
    }
})