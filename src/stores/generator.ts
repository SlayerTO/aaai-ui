import { computed, h, ref, reactive } from "vue";
import { defineStore } from "pinia";
import type { ModelGenerationInputStable, GenerationStable, RequestAsync, GenerationInput, ActiveModel, RequestStatusCheck } from "@/types/stable_horde"
import { useOutputStore, type ImageData } from "./outputs";
import { useUIStore } from "./ui";
import { useOptionsStore } from "./options";
import { useUserStore } from "./user";
import router from "@/router";
import { useCanvasStore } from "./canvas";
import { useDashboardStore } from "./dashboard";
import { useLocalStorage } from "@vueuse/core";
import { MODELS_DB_URL, POLL_MODELS_INTERVAL, DEBUG_MODE, POLL_STYLES_INTERVAL, MAX_PARALLEL_IMAGES, MAX_PARALLEL_REQUESTS } from "@/constants";
import { convertToBase64 } from "@/utils/base64";
import { validateResponse } from "@/utils/validate";
import { ElNotification, type FormRules } from "element-plus";
import { BASE_URL_STABLE } from "@/constants";
import { genrand_int32, MersenneTwister } from '@/utils/mersenneTwister';
import { useLanguageStore } from '@/stores/i18n';

function getDefaultStore() {
    return <ModelGenerationInputStable>{
        steps: 30,
        n: 1,
        sampler_name: "k_euler",
        width: 512,  // make sure these are divisible by 64
        height: 512, // make sure these are divisible by 64
        cfg_scale: 7,
        clip_skip: 1,
        seed_variation: 1000,
        seed: "",
        karras: true,
        denoising_strength: 0.75,
        tiling: false,
        hires_fix: false,
        control_type: "none",
        facefixer_strength: 0.75,
    }
}

function sleep(ms: number) {
    return new Promise(res=>setTimeout(res, ms));
}

export type GenerationStableArray = GenerationStable & Array<GenerationStable>
export interface IModelData {
    name?: string;
    count?: number;
    performance?: number;
    description?: string;
    trigger?: string[];
    showcases?: string[];
    style?: string;
    nsfw?: boolean;
    type?: string;
    eta?: number;
    queued?: number;
}

export interface IStyleData {
    prompt: string;
    model: string;
    sampler_name?: string;
    width?: number;
    height?: number;
}

export type ICurrentGeneration = GenerationInput & {
    jobId: string;
    gathered: boolean;
    waitData?: RequestStatusCheck;
    started?: number;
}

interface ITypeParams {
    sourceProcessing?: "inpainting" | "img2img" | "outpainting";
    sourceImage?: string;
    maskImage?: string;
}

interface IPromptHistory {
    starred: boolean;
    prompt: string;
    timestamp: number;
}

type IHordeGeneratorType = 'Txt2Img' | 'Img2Img' | 'Rating' | 'Interrogation'
type IChaosGeneratorType = 'Txt2Vid' | 'Img2Vid'
type IMultiModel = "Enabled" | "Disabled"
type IGroupedModel ={ label: string; options: {label: string; value: string;}[] }[];

export const useGeneratorStore = defineStore("generator", () => {
    const lang = useLanguageStore();
    const canvasStore = useCanvasStore();
    const validGeneratorTypes = ['Text2Img', 'Img2Img', 'Inpainting'];
    const generatorType = useLocalStorage<IHordeGeneratorType>("generationType", "Txt2Img");
    const generatorChaosType = useLocalStorage<IChaosGeneratorType>("generatorChaosType", "Txt2Vid");

    const prompt = useLocalStorage("lastPrompt", "")
    const promptHistory = useLocalStorage<IPromptHistory[]>("promptHistory", []);
    const negativePrompt = useLocalStorage("lastNegativePrompt", "")
    const negativePromptLibrary = useLocalStorage<string[]>("negativeLibrary", []);
    const params = useLocalStorage<ModelGenerationInputStable>("params", getDefaultStore());

    const slow_workers   = useLocalStorage<boolean>("slow_workers", true);
    const replacement_filter   = useLocalStorage<boolean>("replacement_filter", false);

    const nsfw   = useLocalStorage<boolean>("nsfw", true);
    const censor_nsfw   = useLocalStorage<boolean>("censorNsfw", false);
    const trustedOnly = useLocalStorage<boolean>("trustedOnly", false);

    const availablePostProcessors: ("GFPGAN" | "RealESRGAN_x4plus" | "RealESRGAN_x4plus_anime_6B" | "NMKD_Siax" | "4x_AnimeSharp" | "CodeFormers" | "strip_background")[] = ["GFPGAN", "RealESRGAN_x4plus", "RealESRGAN_x4plus_anime_6B", "NMKD_Siax", "4x_AnimeSharp", "CodeFormers", "strip_background"];

    const availableControlType: ('none' | 'canny' | 'hed' | 'depth' | 'normal' | 'openpose' | 'seg' | 'scribble' | 'fakescribbles' | 'hough')[] = ['none', 'canny', 'hed', 'depth', 'normal', 'openpose', 'seg', 'scribble', 'fakescribbles', 'hough'];

    const availableModelsGrouped = ref<IGroupedModel>([]);
    const modelsData = ref<IModelData[]>([]);
    const modelDescription = computed(() => {
        if (selectedModel.value === "Random!") {
            return lang.GetText(`gengenerateusingrandom`);
        }
        return selectedModelData.value?.description || lang.GetText(`gennotfound`);
    })
    const multiModelSelect = useLocalStorage<IMultiModel>("multiModelSelect", "Disabled");
    const selectedModel = useLocalStorage("selectedModel", "stable_diffusion");
    const selectedModelMultiple = useLocalStorage("selectedModelMultiple", ["stable_diffusion"]);
    const selectedModelData = computed<IModelData>(() => modelsData.value.find(el => el.name === selectedModel.value) || {});

    const multiControlTypeSelect = useLocalStorage<IMultiModel>("multiControlTypeSelect", "Disabled");
    const selectedControlTypeMultiple = useLocalStorage("selectedControlTypeMultiple", ["none"]);
    
    const checkIfNotControlNet = computed<boolean>(() => {
        if (multiControlTypeSelect.value === 'Enabled') {
            return selectedControlTypeMultiple.value.filter((el) => el === 'none').length > 0;
        } else {
            return params.value.control_type === 'none';
        }
        return false;
    });

    const checkIfInpainting = computed<boolean>(() => {
        if (selectedModel.value === 'stable_diffusion_inpainting') return true;
        return false;
    });
    
    const filteredAvailableModelsGrouped = computed(() => {
        if (availableModelsGrouped.value.length === 0) return [];

        var filtered;
        
        if (generatorType.value === "Img2Img") {
            filtered = availableModelsGrouped.value.filter(mg => {
                if (!checkIfNotControlNet)
                    return mg.label !== "inpainting"
                else return true;
            });
        } else {
            filtered = availableModelsGrouped.value;
            if (!checkIfNotControlNet) {
                filtered.forEach(el => el.options = el.options.filter(
                    md =>   md.value !== "stable_diffusion_2.1" && 
                            md.value !== "stable_diffusion_2.1_512" && 
                            md.value !== "stable_diffusion_2.0" && 
                            md.value !== "stable_diffusion_2.0_512" && 
                            md.value !== "Stable Diffusion 2 Depth" && 
                            md.value !== "Graphic-Art" && 
                            md.value !== "Illuminati Diffusion" && 
                            md.value !== "A to Zovya RPG" && 
                            md.value !== "Waifu Diffusion Beta" && 
                            md.value !== "PRMJ" && 
                            md.value !== "Vector Art" && 
                            md.value !== "Pulp Vector Art" && 
                            md.value !== "Pokemon3D" && 
                            md.value !== "CharHelper" && 
                            md.value !== "Concept Sheet" && 
                            md.value !== "Ultraskin" && 
                            md.value !== "Future Diffusion" 
                ));
            }
            filtered.forEach(el => el.options = el.options.filter(
                md => md.value !== "pix2pix" && md.value !== "stable_diffusion_inpainting" 
            ));
        }

        let sModel = filtered.find(el2 => {
            if(!el2) return false;
            return el2.options.find(el => {
                return el.value == selectedModel.value;
            });
        });

        if(!sModel) {
            if(!filtered[0]) return [];
            selectedModel.value = filtered[0].options[0].value;
        }

        if (multiModelSelect !== undefined)
            if ((multiModelSelect.value || "") === "Enabled") 
                filtered = filtered.filter(el => el?.label !== "Extra");

        return filtered;
    })

    const styles = useLocalStorage<{[key: string]: IStyleData}>("styles", {});

    const getDefaultImageProps = (): ITypeParams => ({
        sourceProcessing: undefined,
        sourceImage: undefined,
        maskImage: undefined,
    })

    const img2img = ref(<ITypeParams>{
        ...getDefaultImageProps(),
        sourceProcessing: "img2img",
    })

    const getImageProps = (type: typeof generatorType.value): ITypeParams => {
        if (type === "Img2Img") {
            return img2img.value;
        }
        return getDefaultImageProps();
    }

    const currentImageProps = computed(() => getImageProps(generatorType.value));

    const uploadDimensions = ref("");

    const generating = ref(false);
    const cancelled = ref(false);
    const images    = ref<ImageData[]>([]);
    const gatheredImages = ref(0);
    const queue = ref<ICurrentGeneration[]>([]);
    const queueStatus = computed<RequestStatusCheck>(() => {
        const mergedWaitData: RequestStatusCheck = mergeObjects(queue.value.map(el => el.waitData || {}));
        mergedWaitData.queue_position = Math.round((mergedWaitData?.queue_position || 0) / queue.value.length);
        mergedWaitData.faulted = !queue.value.every(el => !el.waitData?.faulted)
        mergedWaitData.wait_time = (mergedWaitData?.wait_time || 0) / queue.value.length;
        return mergedWaitData;
    });

    const minImages = ref(1);
    const maxImages = computed(() => useOptionsStore().allowLargerParams === "Enabled" ? 500 : 100);
    const minSteps = ref(1);
    const maxSteps = computed(() => useOptionsStore().allowLargerParams === "Enabled" ? 500 : 50);
    const minCfgScale = computed(() => useOptionsStore().allowLargerParams === "Enabled" ? -40 : 1);
    const maxCfgScale = ref(30);
    const minDenoise = ref(0.1);
    const maxDenoise = ref(1);
    const minClipSkip = ref(1);
    const maxClipSkip = ref(12);

    const totalImageCount = computed<number>(() => {
        const newPrompts = promptMatrix();
        let returnValue = newPrompts.length;
        if(multiModelSelect.value === "Enabled") 
        {
            returnValue *= selectedModelMultiple.value.length;
        }
        else
        {
            if(selectedModel.value === "All Models!")
            {
                returnValue *= filteredAvailableModelsGrouped.value.filter(el => el?.label !== "Extra").length;
            }
        }
        if(generatorType.value === "Img2Img" && multiControlTypeSelect.value === "Enabled") 
        {
            returnValue *= selectedControlTypeMultiple.value.filter((el) => el !== "none").length || 1;
        }
        returnValue *= (params.value.n || 1);
        return returnValue;
    })

    const kudosCost = computed(() => {
        const result = Math.pow(((params.value.width as number) * (params.value.height as number)) - (64*64), 1.75) / Math.pow((1024*1024) - (64*64), 1.75);
        const steps = getAccurateSteps();
        
        let kudos = Math.round((((0.1232 * steps) + result * (0.1232 * steps * 8.75))) * 100) / 100;
        (params.value.post_processing || []).forEach( el => {
            kudos = Math.round((kudos * 1.2) * 100) / 100;
        });
        if(generatorType.value === "Img2Img" && params.value.control_type !== "none" && !(params.value.return_control_map || false))
            kudos = Math.round((kudos * 3) * 100) / 100;
        kudos += countParentheses();
        kudos = recordUsage(kudos);
        return kudos * (totalImageCount.value || 1);
    })

    function recordUsage(kudos:number) {
        if(generatorType.value === "Img2Img") kudos *= 1.3;
        if(params.value.post_processing !== undefined) {
            if(params.value.post_processing?.indexOf("GFPGAN") > -1) kudos *= 1.0;
            if(params.value.post_processing?.indexOf("RealESRGAN_x4plus") > -1) kudos *= 1.3;
            if(params.value.post_processing?.indexOf("RealESRGAN_x4plus_anime_6B") > -1) kudos *= 1.3;
            if(params.value.post_processing?.indexOf("NMKD_Siax") > -1) kudos *= 1.1;
            if(params.value.post_processing?.indexOf("4x_AnimeSharp") > -1) kudos *= 1.1;
            if(params.value.post_processing?.indexOf("CodeFormers") > -1) kudos *= 1.3;
            if(params.value.post_processing?.indexOf("strip_background") > -1) kudos *= 1.2;
        }
        let horde_tax = 3;
        if(useOptionsStore().shareWithLaion === "Enabled") horde_tax = 1;
        if(kudos < 10) horde_tax -= 1;
        kudos += horde_tax; 
        if(slow_workers.value == false) kudos *= 1.2; 
        return kudos;
    }

    function countParentheses() {
        const chars = [...prompt.value];
        let count = 0;
        let open = false;
        chars.forEach((c, i) => {
            if(c == "(") {
                open = true;
            } else if (c == ")" && open) {
                open = false;
                count++;
            }
        });
        return count;
    }

    function getAccurateSteps() {
        const { sourceImage, sourceProcessing } = getImageProps(generatorType.value);
        if((params.value.sampler_name || "k_euler_a") == "k_dpm_adaptive") {
            return 50;
        }
        let result: number = params.value.steps || 0;
        if(['k_heun', "k_dpm_2", "k_dpm_2_a", "k_dpmpp_2s_a"].includes(params.value.sampler_name || "k_euler_a")) {
            result *= 2;
        }
        if(sourceImage && sourceProcessing == "img2img"){
            result *= params.value.denoising_strength || 0.8;
        }
        return result;
    }

    const canGenerate = computed(() => {
        const dashStore = useDashboardStore();
        const affordable = (dashStore.user.kudos as number) > kudosCost.value;
        const higherDimensions = (params.value.height as number) * (params.value.width as number) > 1024*1024;
        const higherSteps = (params.value.steps as number) * (/dpm_2|dpm_2_a|k_heun/.test(params.value.sampler_name as string) ? 2 : 1) > 50;
        return affordable || (!higherDimensions && !higherSteps);
    })

    /**
     * Resets the generator store to its default state
     * */ 
    function resetStore()  {
        params.value = getDefaultStore();
        img2img.value = getDefaultImageProps();
        images.value = [];
        useUIStore().showGeneratedImages = false;
        useCanvasStore().resetCanvas();
        return true;
    }

    async function generatePrompt() {
        document.getElementById('ovl')?.classList.add('active');
        MersenneTwister();
        let par = {UserID: useUserStore().userId, Prompt: "", Seed: 0}
        if(prompt.value !== undefined && prompt.value != "") {
            par.Prompt = prompt.value
        }
        par.Seed = genrand_int32()
        const url = `https://api.artificial-art.eu/prompt/query`;
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(par),
            headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'} });
        let resJSON = await response.json();
        let requestRunning = resJSON['success'];
        while (requestRunning) {
            await sleep(1250);
            const url = `https://api.artificial-art.eu/prompt/get?u=${useUserStore().userId}&j=${resJSON['uid']}`;
            const response = await fetch(url);
            let resStatJSON = await response.json();
            if (resStatJSON['success']) {
                prompt.value = resStatJSON['prompt']
                requestRunning = false
                document.getElementById('ovl')?.classList.remove('active');
            }
        }
    }

    const generateFormBaseRules = reactive<FormRules>({
        prompt: [{
            required: true,
            message: lang.GetText(`genpleaseinputprompt`),
            trigger: 'change'
        }],
        apiKey: [{
            required: true,
            message: lang.GetText(`genpleaseinputapi`),
            trigger: 'change'
        }]
    });

    /**
     * Generates images on the Horde; returns a list of image(s)
     * */ 
    async function generateImage(type:IHordeGeneratorType) {
        if (type === "Rating") return [];
        if (prompt.value === "") return generationFailed(lang.GetText(`gennoprompt`));
        if (multiModelSelect.value === "Enabled" && selectedModelMultiple.value.length === 0) return generationFailed(lang.GetText(`gennomodel`));
        if (multiControlTypeSelect.value === "Enabled" && selectedControlTypeMultiple.value.length === 0 && generatorType.value === "Img2Img") return generationFailed(lang.GetText(`gennocontroltype`));

        const canvasStore = useCanvasStore();
        const optionsStore = useOptionsStore();
        const uiStore = useUIStore();

        if(type === "Img2Img") {
            canvasStore.saveImages();
            let counter = 0;
            while(!canvasStore.readyToSubmit) {
                await sleep(200);
                if(++counter == 10) {
                    if (DEBUG_MODE) console.log("ERROR: Timed out while waiting for images.")
                    return;
                }
            }
        }
        
        let model = [selectedModel.value];
        const realModels = filteredAvailableModelsGrouped.value.filter(el => el?.label !== "Extra");
        if (selectedModel.value === "Random!") {
            let categoryId = Math.floor(Math.random() * realModels.length);
            let modelId = Math.floor(Math.random() * realModels[categoryId].options.length);
            model = [realModels[categoryId].options[modelId].value];
        } 
        if (selectedModel.value === "All Models!") {
            realModels.forEach(el => {
                el.options.forEach(el2 => {
                    model.push(el2.value);
                })
            })
        }

        pushToPromptHistory(prompt.value);

        // Cache parameters so the user can't mutate the output data while it's generating
        const paramsCached: GenerationInput[] = [];
        let firstSeed = "";
        if (params.value.seed !== undefined && params.value.seed != "") {
            var numberSeed: number = +params.value.seed;
            if(isNaN(numberSeed) || numberSeed == 0) {
                MersenneTwister();
                firstSeed = genrand_int32().toString();
            } else {
                MersenneTwister(numberSeed);
                firstSeed = numberSeed.toString();
            }
        }

        // Get all prompt matrices (example: {vase|pot}) + models and try to spread the batch size evenly
        const newPrompts = promptMatrix();
        const plannedSeeds = [];
        const requestCount = totalImageCount.value / (params.value.n || 1);
        for (let i = 0; i < (params.value.n || 1); i++) {
            plannedSeeds.push(i == 0 ? firstSeed : genrand_int32().toString());
        }

        for (let i = 0; i < requestCount; i++) {
            const selectCurrentItem = (arr: any[]) => arr[i % arr.length];
            const currentModel = multiModelSelect.value === "Enabled" ? selectCurrentItem(selectedModelMultiple.value) : selectCurrentItem(model);
            const currentControlType = multiControlTypeSelect.value === "Enabled" ? selectCurrentItem(selectedControlTypeMultiple.value) : params.value.control_type;
            const currentPrompt = selectCurrentItem(newPrompts);
            const currentSampler = currentModel.includes("stable_diffusion_2.0") ? "dpmsolver" : params.value.sampler_name
            for (let iN = 0; iN < (params.value.n || 1); iN++) {
                paramsCached.push({
                    prompt: currentPrompt,
                    params: {
                        ...params.value,
                        seed: (+plannedSeeds[iN] - 1).toString(),
                        seed_variation: params.value.seed === "" ? 1000 : 1,
                        post_processing: params.value.post_processing || [],
                        sampler_name: currentSampler,
                        n: 1,
                        control_type: type === "Img2Img" ? params.value.control_type !== "none" ? currentControlType : undefined : undefined,
                    },
                    nsfw: nsfw.value || true,
                    censor_nsfw: !(nsfw.value || true) ? false : censor_nsfw.value,
                    trusted_workers: trustedOnly.value || false,
                    source_image: type === "Img2Img" ? currentImageProps.value.sourceImage?.split(",")[1] : undefined,
                    source_mask: type === "Img2Img" ? currentImageProps.value.maskImage?.split(",")[1] : undefined,
                    source_processing: type === "Img2Img" ? currentImageProps.value.sourceProcessing : undefined,
                    workers: optionsStore.getWokersToUse,
                    models: [currentModel],
                    r2: true,
                    shared: useOptionsStore().shareWithLaion === "Enabled",
                    slow_workers: slow_workers.value || true,
                    replacement_filter: replacement_filter.value || false,
                });
            }
        }

        if (DEBUG_MODE) console.log("Using generation parameters:", paramsCached)

        generating.value = true;
        uiStore.showGeneratedImages = false;

        // Push each item in the parameters array to the queue
        for (let i = 0; i < paramsCached.length; i++) {
            queue.value.push({
                ...paramsCached[i],
                jobId: "",
                gathered: false,
                started: 0,
            })
        }

        // Reset variables
        images.value = [];
        gatheredImages.value = 0;

        function getMaxRequests(arr: GenerationInput[]) {
            let maxRequests = 0;
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                const newSum = sum + (arr[i].params?.n || 1);
                if (newSum > MAX_PARALLEL_IMAGES) break;
                sum = newSum;
                maxRequests++;
            }
            return Math.min(maxRequests, MAX_PARALLEL_REQUESTS);
        }

        let requestRunning = 0;
        // Loop until queue is done or generation is cancelled
        let secondsElapsed = 0;
        while (!queue.value.every(el => el.gathered) && !cancelled.value) {
            if (queueStatus.value.done) await sleep(200);

            const nonGatheredQueue = queue.value.filter(el => !el.gathered);
            for (const queuedImage of nonGatheredQueue.slice(0, getMaxRequests(nonGatheredQueue))) {
                if (cancelled.value) break;
                if (queuedImage.waitData?.done) continue;

                const t0 = performance.now() / 1000;

                if (!queuedImage.jobId && requestRunning <= 25) {
                    requestRunning++;
                    const resJSON = await fetchNewID(queuedImage);
                    if (!resJSON) return generationFailed();
                    queuedImage.jobId = resJSON.id as string;
                    queuedImage.started = performance.now() / 1000;
                }
    
                const status = await checkImage(queuedImage.jobId);
                if (!status) return generationFailed();
                if ((status as RequestStatusCheck).faulted) return generationFailed(lang.GetText(`genfaulted`));
                if ((status as RequestStatusCheck).is_possible === false) return generationFailed(lang.GetText(`gennotpossible`));
                queuedImage.waitData = (status as RequestStatusCheck);

                if ((status as RequestStatusCheck).done) {
                    const finalImages = await getImageStatus(queuedImage.jobId);
                    if (!finalImages) return generationFailed();
                    processImages(finalImages.map(image => ({...image, ...queuedImage})))
                        .then(() => {
                            queuedImage.gathered = true; 
                            requestRunning--;
                        });
                }
                
                await sleep(500);
    
                const t1 = performance.now() / 1000;
                secondsElapsed += t1 - t0;

                uiStore.updateProgress(queueStatus.value, secondsElapsed);
            }
            if (DEBUG_MODE) console.log("Checked all images:", queueStatus.value);
        }

        if (DEBUG_MODE) console.log("Images done/cancelled");

        if (cancelled.value) {
            // Retrieve final images that were cancelled
            for (const queuedImage of queue.value) {
                if (queuedImage.gathered || queuedImage.jobId === "") continue;
                const finalImages = cancelled.value ? await cancelImage(queuedImage.jobId) : await getImageStatus(queuedImage.jobId);
                if (!finalImages) return generationFailed();
                if (finalImages.length === 0) continue;
                await processImages(finalImages.map(image => ({...image, ...queuedImage})));
            }
            if (DEBUG_MODE) console.log("Got cancelled images");
        }

        return generationDone();
    }

    function mergeObjects(data: any[]) {
        return data.reduce((prev, curr) => {
            for (const [key, value] of Object.entries(curr)) {
                if (typeof value === "boolean") {
                    if (prev[key] === undefined) prev[key] = value;
                    prev[key] = prev[key] && value;
                    continue;
                }
                if (!prev[key]) prev[key] = 0;
                prev[key] += value;
            }
            return prev;
        }, {});
    }

    /**
     * Called when an image has failed.
     * @returns []
     */
    async function generationFailed(error?: string) {
        const store = useUIStore();
        if (error) store.raiseError(error, false);
        generating.value = false;
        cancelled.value = false;
        store.progress = 0;
        for (const { jobId } of queue.value) {
            await cancelImage(jobId);
        }
        queue.value = [];
        return [];
    }
    
    function validateParam(paramName: string, param: number, max: number, defaultValue: number) {
        if (param <= max) return param;
        useUIStore().raiseWarning(lang.GetText('genlargervalues', {'%paramName%': paramName, '%param%': param.toString()}), true)
        return defaultValue;
    }

    /**
     * Prepare an image for going through txt2img on the Horde
     * */ 
    function generateTxt2Img(data: ImageData, correctDimensions = true) {
        const defaults = getDefaultStore();
        generatorType.value = "Txt2Img";
        multiModelSelect.value = "Disabled";
        router.push("/");
        if (correctDimensions) {
            const calculateNewDimensions = (value: number) => data.post_processing?.includes("RealESRGAN_x4plus") ? value / 4 : value;
            data.width = calculateNewDimensions(data.width || defaults.width as number);
            data.height = calculateNewDimensions(data.height || defaults.height as number);
        }
        if (data.prompt) {
            const splitPrompt = data.prompt.split(" ### ");
            prompt.value = splitPrompt[0];
            negativePrompt.value = splitPrompt[1] || "";
        }
        if (data.sampler_name)    params.value.sampler_name = data.sampler_name;
        if (data.steps)           params.value.steps = validateParam("steps", data.steps, maxSteps.value, defaults.steps as number);
        if (data.cfg_scale)       params.value.cfg_scale = data.cfg_scale;
        if (data.clip_skip)       params.value.clip_skip = data.clip_skip;
        if (data.facefixer_strength) params.value.facefixer_strength = data.facefixer_strength;
        if (data.width)           params.value.width = validateParam("width", data.width, maxWidth.value, defaults.width as number);
        if (data.height)          params.value.height = validateParam("height", data.height, maxHeight.value, defaults.height as number);
        if (data.seed)            params.value.seed = data.seed;
        if (data.karras)          params.value.karras = data.karras;
        if (data.post_processing) params.value.post_processing = data.post_processing as typeof availablePostProcessors;
        if (data.modelName)       selectedModel.value = data.modelName;
        if (data.hires_fix)       params.value.hires_fix = data.hires_fix
    }

    /**
     * Prepare an image for going through img2img on the Horde
     * */ 
    function generateImg2Img(sourceimg: string) {
        generatorType.value = "Img2Img";
        img2img.value.sourceImage = sourceimg;
        canvasStore.isDrawing = false;
        images.value = [];
        router.push("/");
        canvasStore.addImageObjectToCanvas(sourceimg);
        // Note: unused code
        // const img = new Image();
        // img.onload = function() {
        //     uploadDimensions.value = `${(this as any).naturalWidth}x${(this as any).naturalHeight}`;
        // }
        // img.src = newImgUrl;
    }

    /**
     * Combines positive and negative prompt
     */
    function getFullPrompt() {
        if (negativePrompt.value === "") return prompt.value;
        return `${prompt.value} ### ${negativePrompt.value}`;
    }

    /**
     * Returns all prompt matrix combinations
     */
    function promptMatrix() {
        const prompt = getFullPrompt();
        const matrixMatches = prompt.match(/\{(.*?)\}/g) || [];
        if (matrixMatches.length === 0) return [prompt];
        let prompts: string[] = [];
        matrixMatches.forEach(matrix => {
            const newPrompts: string[] = [];
            const options = matrix.replace("{", "").replace("}", "").split("|");
            if (prompts.length === 0) {
                options.forEach(option => {
                    const newPrompt = prompt.replace(matrix, option);
                    newPrompts.push(newPrompt);
                });
            } else {
                prompts.forEach(previousPrompt => {
                    options.forEach(option => {
                        const newPrompt = previousPrompt.replace(matrix, option);
                        newPrompts.push(newPrompt);
                    });
                });
            }
            prompts = [...newPrompts];
        });
        return prompts;
    }

    function addDreamboothTrigger(trigger?: string) {
        if (!selectedModelData.value?.trigger) return;
        if (prompt.value.includes((trigger || selectedModelData.value.trigger[0]))) return;
        prompt.value = (trigger || selectedModelData.value.trigger[0]) + ", " + prompt.value;
    }

    /**
     * Fetches a new ID
     */
    async function fetchNewID(parameters: GenerationInput) {
        if (DEBUG_MODE) console.log("New Generation: ", parameters)
        const userStore = useUserStore();
        const response: Response = await fetch(`${BASE_URL_STABLE}/api/v2/generate/async`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'apikey': userStore.apiKey,
            },
            body: JSON.stringify(parameters)
        })
        const resJSON: RequestAsync = await response.json();
        if (!validateResponse(response, resJSON, 202, lang.GetText(`genfailedtofetchid`), onInvalidResponse)) return false;
        return resJSON;
    }

    /**
     * Called when a generation is finished.
     * */ 
    async function processImages(finalImages: (GenerationStable & ICurrentGeneration)[]) {
        const store = useOutputStore();
        const optionsStore = useOptionsStore();
        const userStore = useUserStore();
        const finalParams: ImageData[] = await Promise.all(
            finalImages.map(async (image) => {
                let { img } = image;
                if (image.r2) {
                    const res = await fetch(`${img}`);
                    const blob = await res.blob();
                    const base64 = await convertToBase64(blob) as string;
                    img = base64.split(",")[1];
                    gatheredImages.value++;
                }
                const { params } = image;
                return {
                    // The database automatically increments IDs for us
                    id: -1,
                    jobId: image.jobId,
                    image: `data:image/webp;base64,${img}`,
                    hordeImageId: image.id,
                    sharedExternally: optionsStore.shareWithLaion === "Enabled" || userStore.apiKey === '0000000000',
                    prompt: image.prompt,
                    modelName: image.model,
                    workerID: image.worker_id,
                    workerName: image.worker_name,
                    seed: image.seed,
                    steps: params?.steps,
                    sampler_name: params?.sampler_name,
                    width: (params?.width as number) * ((params?.post_processing || []).includes("RealESRGAN_x4plus") ? 4 : 1),
                    height: (params?.height as number) * ((params?.post_processing || []).includes("RealESRGAN_x4plus") ? 4 : 1),
                    cfg_scale: params?.cfg_scale,
                    denoising_strength: params?.denoising_strength,
                    clip_skip: params?.clip_skip,
                    facefixer_strength: params?.facefixer_strength,
                    karras: params?.karras,
                    hires_fix: params?.hires_fix,
                    post_processing: params?.post_processing,
                    tiling: params?.tiling,
                    slow_worker: image.slow_workers,
                    replacement_filter: image.replacement_filter,
                    starred: 0,
                    rated: 0,
                    control_net: params?.control_type?.toString(),
                    generation_time: (performance.now() / 1000) - (image.started || 0),
                    generation_date: new Date().toISOString()
                }
            })
        )
        images.value = [...images.value, ...await store.pushOutputs(finalParams) as ImageData[]];

        return finalParams;
    }

    /**
     * Called when a generation is finished.
     * */ 
    async function generationDone() {
        const uiStore = useUIStore();

        generating.value = false;
        cancelled.value = false;
        uiStore.progress = 0;
        uiStore.showGeneratedImages = true;
        queue.value = [];

        const onGeneratorPage = router.currentRoute.value.fullPath === "/";
        if ((onGeneratorPage && generatorType.value === "Rating") || !onGeneratorPage) {
            uiStore.showGeneratorBadge = true;
            const notification = ElNotification({
                title: 'Images Finished',
                message: h("div", [
                    'View your new images ',
                    h("span", {
                        style: {
                            color: "var(--el-menu-active-color)",
                            cursor: "pointer",
                        },
                        onClick: () => {
                            if (generatorType.value === "Rating") generatorType.value = "Txt2Img";
                            uiStore.showGeneratorBadge = false;
                            router.push("/");
                            notification.close();
                        },
                    }, "here!"),
                ]),
                icon: h("img", {
                    src: images.value[0].image,
                    style: { maxHeight: "54px", maxWidth: "54px" },
                }),
                customClass: "image-notification",
            });
        }

        return images.value;
    }

    /**
     * Gets information about the generating image(s). Returns false if an error occurs.
     * */ 
    async function checkImage(imageID: string, tries: number = 0): Promise<RequestStatusCheck | boolean> {
        const response = await fetch(`${BASE_URL_STABLE}/api/v2/generate/check/`+imageID);
        
        if (response.status == 500) {
            tries++;
            if (tries < 5)
                return checkImage(imageID, tries);
        }

        const resJSON: RequestStatusCheck = await response.json();
        if (cancelled.value) return { wait_time: 0, done: false };
        if (!validateResponse(response, resJSON, 200, lang.GetText(`genfailedtocheckimagestatus`), onInvalidResponse)) return false;
        return resJSON;
    }

    /**
     * Cancels the generating image(s) and returns their state. Returns false if an error occurs.
     * */ 
    async function cancelImage(imageID: string) {
        queue.value = [];
        const response = await fetch(`${BASE_URL_STABLE}/api/v2/generate/status/`+imageID, {
            method: 'DELETE',
        });
        const resJSON = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`genfailedtocancelimage`), onInvalidResponse)) return false;
        const generations: GenerationStable[] = resJSON.generations;
        return generations;
    }

    /**
     * Gets the final status of the generated image(s). Returns false if response is invalid.
     * */ 
    async function getImageStatus(imageID: string) {
        const response = await fetch(`${BASE_URL_STABLE}/api/v2/generate/status/`+imageID);
        const resJSON = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`genfailedtocheckimagestatus`), onInvalidResponse)) return false;
        const generations: GenerationStable[] = resJSON.generations;
        return generations;
    }

    function onInvalidResponse(msg: string) {
        const uiStore = useUIStore();
        uiStore.raiseError(msg, false);
        uiStore.progress = 0;
        cancelled.value = false;
        images.value = [];
        return false;
    }

    /**
     * Updates available models
     * */ 
    async function updateAvailableModels() {
        const response = await fetch(`${BASE_URL_STABLE}/api/v2/status/models`);
        const resJSON: ActiveModel[] = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`genfailedtogetavailablemodels`))) return;

        const dbResponse = await fetch(MODELS_DB_URL);
        const dbJSON = await dbResponse.json();
        const nameList = Object.keys(dbJSON);

        // Format model data
        const newStuff: IModelData[] = nameList.map(name => {
            const { description, style, nsfw, type, trigger, showcases } = dbJSON[name];
            const {
                queued = 0,
                eta = Infinity,
                count = 0,
                performance = 0,
            } = resJSON.find(el => el.name === name) || {};
          
            return {
                name,
                description,
                style,
                nsfw,
                type,
                trigger,
                showcases,
                queued,
                eta,
                count,
                performance,
            };
        });
        modelsData.value = newStuff;
        
        availableModelsGrouped.value = [];
        modelsData.value.forEach((model) => {
            if(
                nsfw.value ||
                !nsfw.value && model.nsfw == false
                )
            {
                let restModel = resJSON.find(el => el.name == model.name);
                if (restModel != null)
                {
                    let modelStyle = availableModelsGrouped.value.find(el2 => el2.label == model.style);
                    if(modelStyle != null)
                        modelStyle.options.push({value: restModel.name as string, label: `${(model.nsfw == true?"[NSFW] ":"")}${restModel.name} (${restModel.count})`});
                    else
                    availableModelsGrouped.value.push({ label: model.style as string, options: [{value: restModel.name as string, label: `${(model.nsfw == true?"[NSFW] ":"")}${restModel.name} (${restModel.count})`}] })

                }
            }
        });

        availableModelsGrouped.value.push({ label: 'Extra', options: [{value: lang.GetText(`genrandom`), label: lang.GetText(`genrandom`)}, {value: lang.GetText(`genallmodels`), label: lang.GetText(`genallmodels`)}] });
    }

    async function updateStyles() {
        const response = await fetch(`https://raw.githubusercontent.com/db0/Stable-Horde-Styles/main/styles.json`);
        styles.value = await response.json();
    }

    function pushToNegativeLibrary(prompt: string) {
        if (negativePromptLibrary.value.indexOf(prompt) !== -1) return;
        negativePromptLibrary.value = [...negativePromptLibrary.value, prompt];
    }

    function removeFromNegativeLibrary(prompt: string) {
        negativePromptLibrary.value = negativePromptLibrary.value.filter(el => el != prompt);
    }

    function pushToPromptHistory(prompt: string) {
        if (promptHistory.value.findIndex(el => el.prompt === prompt) !== -1) return;
        if (promptHistory.value.length >= 10 + promptHistory.value.filter(el => el.starred).length) {
            const unstarredHistory = promptHistory.value.filter(el => !el.starred).sort((a,b) => b.timestamp - a.timestamp);
            const lastUnstarredIndex = promptHistory.value.findIndex(el => el === unstarredHistory[unstarredHistory.length - 1]);
            promptHistory.value.splice(lastUnstarredIndex, 1);
        }
        promptHistory.value = [
            ...promptHistory.value,
            {
                starred: false,
                timestamp: Date.now(),
                prompt,
            }
        ];
    }

    function removeFromPromptHistory(prompt: string) {
        //@ts-ignore
        promptHistory.value = promptHistory.value.filter(el => el.prompt != prompt && el != prompt);
    }

    /**
     * Generates a prompt (either creates a random one or extends the current prompt)
     * */
    function getPrompt()  {
        return false;
    }

    updateAvailableModels()
    updateStyles()
    setInterval(updateAvailableModels, POLL_MODELS_INTERVAL * 1000)
    setInterval(updateStyles, POLL_STYLES_INTERVAL * 1000)
    
    const minWidth = ref(64);
    const maxWidth = computed(() => useOptionsStore().allowLargerParams === "Enabled" ? 3072 : 1024);
    const minHeight = ref(64);
    const maxHeight = computed(() => useOptionsStore().allowLargerParams === "Enabled" ? 3072 : 1024);

    

    return {
        // Constants
        availablePostProcessors,
        availableControlType,
        validGeneratorTypes,
        // Variables
        generatorType,
        generatorChaosType,
        prompt,
        params,
        images,
        nsfw,
        censor_nsfw,
        trustedOnly,
        img2img,
        uploadDimensions,
        cancelled,
        selectedModel,
        selectedModelMultiple,
        selectedControlTypeMultiple,
        multiModelSelect,
        multiControlTypeSelect,
        negativePrompt,
        generating,
        modelsData,
        negativePromptLibrary,
        minImages,
        maxImages,
        minSteps,
        maxSteps,
        minCfgScale,
        maxCfgScale,
        minClipSkip,
        maxClipSkip,
        minDenoise,
        maxDenoise,
        queue,
        gatheredImages,
        promptHistory,
        styles,
        availableModelsGrouped,
        minWidth,
        maxWidth,
        minHeight,
        maxHeight,
        slow_workers,
        replacement_filter,
        // Computed
        filteredAvailableModelsGrouped,
        kudosCost,
        canGenerate,
        modelDescription,
        queueStatus,
        selectedModelData,
        currentImageProps,
        totalImageCount,
        checkIfNotControlNet,
        // Actions
        generateImage,
        generateTxt2Img,
        generateImg2Img,
        getImageStatus,
        getPrompt,
        addDreamboothTrigger,
        checkImage,
        cancelImage,
        resetStore,
        pushToNegativeLibrary,
        removeFromNegativeLibrary,
        pushToPromptHistory,
        removeFromPromptHistory,
        generateFormBaseRules,
        checkIfInpainting,
        generatePrompt,
    };
});