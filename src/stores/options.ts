import { defineStore } from "pinia";
import { useLocalStorage } from '@vueuse/core'
import { ref, computed, watch, onMounted } from 'vue';
import type { WorkerDetailsStable } from "@/types/stable_horde";


type IToggle = "Enabled" | "Disabled";
type IPictureType = "WEBP" | "PNG" | "JPG";

export const useOptionsStore = defineStore("options", () => {
    const pageSize = useLocalStorage("pageSize", 25);
    const pageless = useLocalStorage<IToggle>("pageless", "Disabled");
    const allowLargerParams = useLocalStorage<IToggle>("allowLargerParams", "Disabled");
    const shareWithLaion = useLocalStorage<IToggle>("shareWithLaion", "Disabled");
    const autoCarousel = useLocalStorage<IToggle>("autoCarousel", "Enabled");
    const zipMetaData = useLocalStorage<IToggle>("zipMetaData", "Enabled");
    const useBeta = useLocalStorage<IToggle>("useBeta", "Disabled");
    const useWorkers = useLocalStorage<string[]>("usedWorkers",[]);
    const pictureDownloadType = useLocalStorage<IPictureType>("downloadType", "JPG");
    const useAIEUHorde = useLocalStorage<IToggle>("useAIEUHorde", "Disabled");

    const getWokersToUse = computed<string[]>(() => {
        var allowedWorkers: string[] = [];

        useWorkers.value.forEach(el => {
            allowedWorkers.push(el);
        });

        return allowedWorkers;
    });

    function isWorkerWhitelisted(worker: WorkerDetailsStable) {
        return !useWorkers.value.find(element => worker.id == element)
    }

    function workerLimit() {
        if (useWorkers.value.length < 5) {
            return false;
        }
        return true;
    }

    function getListMode() {
        return "Whitelist";
    }

    function addWorkerToSelection(worker: WorkerDetailsStable) {
        if (useWorkers.value.length < 5) {
            useWorkers.value.push(worker.id as string);
        }
    }

    function delWorkerToSelection(worker: WorkerDetailsStable) {
        useWorkers.value = useWorkers.value.filter(obj => obj !== worker.id as string);
    }
    
    const colorMode = useLocalStorage("selectedColorMode", "dark");
    const lastColorMode = ref("");

    onMounted(refreshColorMode);

    function refreshColorMode()
    {
        if(lastColorMode.value == colorMode.value)
            return;

        if(lastColorMode.value != "") {
            document.documentElement.classList.remove(lastColorMode.value);
        }

        document.documentElement.classList.add(colorMode.value);
        lastColorMode.value = colorMode.value;
    }

    watch(colorMode, () => {
        refreshColorMode()
    });

    return {
        // Variables
        colorMode,
        pageSize,
        pageless,
        allowLargerParams,
        autoCarousel,
        zipMetaData,
        useBeta,
        useAIEUHorde,
        useWorkers,
        shareWithLaion,
        pictureDownloadType,
        // Computed
        getWokersToUse,
        // Actions
        isWorkerWhitelisted,
        workerLimit,
        getListMode,
        addWorkerToSelection,
        delWorkerToSelection
    };
});
