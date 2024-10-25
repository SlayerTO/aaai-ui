import type { TeamDetailsStable, WorkerDetailsStable } from "@/types/stable_horde";
import { defineStore } from "pinia";
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from "vue";
import { useGeneratorStore, type IModelData } from "./generator";
import { BASE_URL_AI_STABLE, BASE_URL_EU_STABLE, POLL_WORKERS_INTERVAL, DEBUG_MODE } from "@/constants";
import { validateResponse } from "@/utils/validate";
import { useLanguageStore } from '@/stores/i18n';
import { useOptionsStore } from '@/stores/options';
type SortOptions = "Default" | "Name" | "Info" | "Uptime" | "MPS" | "Speed" | "Requests" | "Model Count" | "Worker Count" | "Queued" | "Clear Time"

export const useWorkerStore = defineStore("workers", () => {
    const lang = useLanguageStore();
    const settings = useOptionsStore();
    const workers = ref<WorkerDetailsStable[]>([]);
    const teams = ref<TeamDetailsStable[]>([]);
    const sortBy = useLocalStorage<SortOptions>("sortBy", "Default");
    const searchFilter = useLocalStorage("sortFilter", "");
    const sortDirection = useLocalStorage<"Ascending" | "Descending">("sortDirection", "Descending");
    const activeTab = useLocalStorage<"workers" | "teams" | "models">("activceWorkerTab", 'workers');

    function filterBySearch<T extends { name?: string }>(data: T[]) {
        return data.filter(el => (el?.name || "").toLowerCase().includes(searchFilter.value.toLowerCase()));
    }

    const descending = computed(() => sortDirection.value === "Descending");
    const sortedByNameWorkers = computed(() => workers.value.sort((t1, t2) => {
        const name1 = (t1.name?.toLowerCase() || "");
        const name2 = (t2.name?.toLowerCase() || "");
        if (name1 > name2) { return 1; }
        if (name1 < name2) { return -1; }
        return 0;
      }));
    const sortedWorkers = computed(() => filterBySearch(sortWorkersBy(sortBy.value, descending.value, workers.value)))
    const sortedTeams = computed(() => filterBySearch(sortTeamsBy(sortBy.value, descending.value, teams.value)))
    const sortedModels = computed(() => {
        var filteredList = useGeneratorStore().modelsData.filter(el => el.type === "ckpt");
        if (settings.useAIEUHorde) {
            filteredList = useGeneratorStore().modelsData;
        }
        var sortedList = sortModelsBy(sortBy.value, descending.value, filteredList);
        return filterBySearch(sortedList);
    });
    const sortOptions = computed<SortOptions[]>(() => {
        let options: SortOptions[] = ["Default", "Name", "Info", "Uptime","Speed", "Requests"];
        if (activeTab.value === "workers") options = [...options, "MPS"];
        if (activeTab.value === "teams") options = [...options, "MPS", "Worker Count", "Model Count"];
        if (activeTab.value === "models") options = [...options, "Queued", "Clear Time", "Worker Count"];
        if (!options.includes(sortBy.value)) sortBy.value = "Info";
        return options;
    });

    const minHeight = ref(64);
    const maxHeight = computed(() => {
        let currentWidth = (useGeneratorStore().params.width || 64);
        let currentHeight = (useGeneratorStore().params.height || 64);
        let testPixel = currentWidth * currentHeight;
        getMaximumPixel();
        let maxHeight = currentHeight;
        let iteration = 0;
        if (MaxPixels == 0 || MaxPixels == testPixel) {
            return maxHeight;
        } else if (MaxPixels < testPixel) {
            while(MaxPixels < testPixel) {
                testPixel = currentWidth * (currentHeight + --iteration * 64);
            }
            useGeneratorStore().params.height = (currentHeight + iteration * 64);
            maxHeight = useGeneratorStore().params.height || 64;
        } else if (MaxPixels > testPixel) {
            while(MaxPixels >= testPixel) {
                testPixel = currentWidth * (currentHeight + ++iteration * 64);
            }
            maxHeight = currentHeight + --iteration * 64;
        }
        return maxHeight;
    });

    const minWidth = ref(64);
    const maxWidth = computed(() => {
        let currentWidth = (useGeneratorStore().params.width || 64);
        let currentHeight = (useGeneratorStore().params.height || 64);
        let testPixel = currentWidth * currentHeight;
        getMaximumPixel();
        let maxWidth = currentWidth;
        let iteration = 0;
        if (MaxPixels == 0 || MaxPixels == testPixel) {
            return maxWidth;
        } else if (MaxPixels < testPixel) {
            while(MaxPixels < testPixel) {
                testPixel = (currentWidth + --iteration * 64) * currentHeight;
            }
            useGeneratorStore().params.width = (currentWidth + iteration * 64);
            maxWidth = useGeneratorStore().params.width || 64;
        } else if (MaxPixels > testPixel) {
            while(MaxPixels >= testPixel) {
                testPixel = (currentWidth + ++iteration * 64) * currentHeight;
            }
            maxWidth = currentWidth + --iteration * 64;
        }
        return maxWidth;
    });

    let MaxPixels = 0;
    let LastModel = "";

    function getMaximumPixel() {
        if (LastModel !== (useGeneratorStore().selectedModel || "")) {
            getAllWorkersWithModel((useGeneratorStore().selectedModel || ""));
            LastModel = (useGeneratorStore().selectedModel || "");
        }
        MaxPixels = 0;
        CurrentModelWorkers.forEach(el => {
            MaxPixels = (el.max_pixels || 0) > MaxPixels ? (el.max_pixels || 0) : MaxPixels;
        });
    }

    let CurrentModelWorkers: WorkerDetailsStable[] = [];

    function getAllWorkersWithModel(modelName: string) {
        CurrentModelWorkers = [];
        if(workers.value.length > 0)
            workers.value.forEach(element => {
                element.models?.forEach(ml => {
                    if (ml == modelName) {
                        CurrentModelWorkers.push(element);
                        return;
                    }
                });
            });
        return CurrentModelWorkers;
    }
    
    function updateStore() {
        if (DEBUG_MODE) console.log("Attempting to update worker store...")
        updateWorkers();
        // Teams don't need to get updated every time
        //updateTeams();
    }

    /** <>
     * Updates the current list of workers
     * */ 
    function updateWorkers() {
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/workers`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/workers`;
        }    
        fetch(fetchUri).then(response => {
            response.json().then(resJSON => {
                if (!validateResponse(response, resJSON, 200, lang.GetText(`workfailedtoupdateworkers`))) return;
                if (DEBUG_MODE) console.log("Updated workers!", resJSON)
                workers.value = [];
                (resJSON as WorkerDetailsStable[]).forEach(el => {
                    if (settings.useAIEUHorde === 'Enabled') {
                        workers.value.push(el);
                    } else {
                        if(el.type == "image") {
                            workers.value.push(el);
                        }
                    }
                });
                if (DEBUG_MODE) console.log("Currently Active: ", workers)
                getAllWorkersWithModel((useGeneratorStore().selectedModel || ""));
                getMaximumPixel();
            });
        });
    }

    async function updateTeams() {
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/teams`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/teams`;
        }    
        const response = await fetch(fetchUri);
        const resJSON: TeamDetailsStable[] = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`workfailedtoupdateteams`))) return;
        if (DEBUG_MODE) console.log("Updated teams!", resJSON)
        teams.value = resJSON;
    }

    function sortArray<T, K extends keyof T>(sortType: K, descending = true, data: T[]) {
        // Spread into new array to prevent mutations
        return [...data].sort((a, b) => {
            let cmpA: number | T[K] = a[sortType] || 0;
            let cmpB: number | T[K] = b[sortType] || 0;
            if (typeof cmpA === "string") cmpA = cmpA?.length || 0;
            if (typeof cmpB === "string") cmpB = cmpB?.length || 0;
            if (typeof cmpA !== "number") return 0;
            if (typeof cmpB !== "number") return 0;
            if (descending) return cmpB - cmpA;
            return cmpA - cmpB;
        })
    }

    function sortModelArrayByName(descending = true, data: IModelData[])
    {
        return [...data].sort((a, b) => {
            if ( (a.name || "") < (b.name || "") ){
                if (descending)
                    return -1;
                else
                    return 1;
            }
            if ( (a.name || "") > (b.name || "") ){
                if (descending)
                    return 1;
                else
                    return -1;
            }
            return 0;
        })
    }

    function sortTeamsArrayByName(descending = true, data: TeamDetailsStable[])
    {
        return [...data].sort((a, b) => {
            if ( (a.name || "") < (b.name || "") ){
                if (descending)
                    return -1;
                else
                    return 1;
            }
            if ( (a.name || "") > (b.name || "") ){
                if (descending)
                    return 1;
                else
                    return -1;
            }
            return 0;
        })
    }

    function sortWorkersArrayByName(descending = true, data: WorkerDetailsStable[])
    {
        return [...data].sort((a, b) => {
            if ( (a.name || "") < (b.name || "") ){
                if (descending)
                    return -1;
                else
                    return 1;
            }
            if ( (a.name || "") > (b.name || "") ){
                if (descending)
                    return 1;
                else
                    return -1;
            }
            return 0;
        })
    }

    function sortWorkersBy(sortType: SortOptions, descending = true, data: WorkerDetailsStable[]) {
        // Spread into new array to prevent mutations
        let value: typeof data = [...data];

        if (sortType == "Name") value = sortWorkersArrayByName(descending, data);
        if (sortType == "Info" || sortType == "Default") value = sortArray("info", descending, data);
        if (sortType == "Uptime") value = sortArray("uptime", descending, data);
        if (sortType == "MPS") value = sortArray("megapixelsteps_generated", descending, data);
        if (sortType == "Speed") {
            value = value.sort((a, b) => {
                const cmpA:number = Number(a.performance?.split(" ")[0]) || 0;
                const cmpB:number = Number(b.performance?.split(" ")[0]) || 0;
                if (descending) return cmpB - cmpA;
                return cmpA - cmpB;
            })
        }
        if (sortType == "Requests") value = sortArray("requests_fulfilled", descending, data);
        if (sortType == "Model Count") value = sortArray("models", descending, data);

        return value;
    }

    function sortTeamsBy(sortType: SortOptions, descending = true, data: TeamDetailsStable[]) {
        // Spread into new array to prevent mutations
        let value: typeof data = [...data];

        if (sortType == "Name") value = sortTeamsArrayByName(descending, data);
        if (sortType == "Info") value = sortArray("info", descending, data);
        if (sortType == "Uptime") value = sortArray("uptime", descending, data);
        if (sortType == "MPS") value = sortArray("contributions", descending, data);
        if (sortType == "Speed") value = sortArray("performance", descending, data);
        if (sortType == "Requests") value = sortArray("requests_fulfilled", descending, data);
        if (sortType == "Model Count") value = sortArray("models", descending, data);
        if (sortType == "Worker Count") value = sortArray("worker_count", descending, data);

        return value;
    }

    function sortModelsBy(sortType: SortOptions, descending = true, data: IModelData[]) {
        // Spread into new array to prevent mutations
        let value: typeof data = [...data];
        if (sortType == "Default") {
            value = sortArray("count", descending, data);
            value = sortArray("queued", descending, value);
        }
        if (sortType == "Name") value = sortModelArrayByName(descending, data);
        if (sortType == "Info") value = sortArray("description", descending, data);
        if (sortType == "Queued") value = sortArray("queued", descending, data);
        if (sortType == "Speed") value = sortArray("performance", descending, data);
        if (sortType == "Worker Count") value = sortArray("count", descending, data);
        if (sortType == "Clear Time") value = sortArray("eta", descending, data);

        return value;
    }

    updateStore();
    updateTeams();
    setInterval(updateStore, POLL_WORKERS_INTERVAL * 1000);

    return {
        // Variables
        workers,
        teams,
        sortBy,
        sortDirection,
        searchFilter,
        activeTab,
        // Computed
        sortedByNameWorkers,
        sortedWorkers,
        sortedTeams,
        sortedModels,
        sortOptions,
        minHeight,
        maxHeight,
        minWidth,
        maxWidth,
        // Actions
        updateWorkers,
        getAllWorkersWithModel
    };
});
