<script setup lang="ts">
import { computed } from 'vue';
import { useLanguageStore } from '@/stores/i18n';
import { ElForm, ElRow, ElCol } from 'element-plus';
import FormSlider from './FormSlider.vue';
import FormSeed from './FormSeed.vue';
import FormModelSelect from './FormModelSelect.vue';
import FormSelect from './FormSelect.vue';
import FormOnOffButton from './FormOnOffButton.vue';
import FormPromptInput from './FormPromptInput.vue';
import FormImagePreview from './FormImagePreview.vue';
import { useGeneratorStore } from '@/stores/generator';
import { useCanvasStore } from '@/stores/canvas';
import { Check, Close } from '@element-plus/icons-vue';
import { useOptionsStore } from '@/stores/options';

const store = useGeneratorStore();
const lang = useLanguageStore();
const canvasStore = useCanvasStore();

const samplerListDBH = ["k_lms", "k_heun", "k_euler", "k_euler_a", "k_dpm_2", "k_dpm_2_a", "k_dpm_fast", "k_dpm_adaptive", "k_dpmpp_2s_a", "k_dpmpp_2m", "k_dpmpp_sde", "DDIM"];
const samplerListAAH = ["Euler", "Euler a", "Heun", "LMS", "DDIM", "DDIM CFG++", "PLMS", "UniPC", "LCM", "Restart", "DPM fast", "DPM adaptive", "DPM2", "DPM2 a", "DPM++ 2M", "DPM++ SDE", "DPM++ 2M SDE", "DPM++ 2M SDE Heun", "DPM++ 2S a", "DPM++ 3M SDE"];

const availableSamplers = computed(() => {
    if (store.selectedModel === "stable_diffusion_2.0") return updateCurrentSampler(["dpmsolver"])
    if (useOptionsStore().useAIEUHorde === 'Enabled')
        return updateCurrentSampler(samplerListAAH);
    else
        return updateCurrentSampler(samplerListDBH);
})

function updateCurrentSampler(newSamplers: string[]) {
    if (!store.params) return newSamplers;
    if (!store.params.sampler_name) return newSamplers;
    if (newSamplers.indexOf(store.params.sampler_name) === -1) {
        store.params.sampler_name = newSamplers[0] as any;
    }
    return newSamplers;
}

function onDimensionsChange() {
    //canvasStore.showCropPreview = true;
    //canvasStore.updateCropPreview();
}

function getAspectRatio(isWidth: boolean) {
    let width = (store.params.width || 1);
    let height = (store.params.height || 1);
    let dividend = 0;
    let divisor = 0;
    if(width == height) {
        return "(1:1)";
    } else {
        if(height>width) {
            dividend = height;
            divisor = width;
        }
        if(width>height) {
            dividend = width;
            divisor = height;
        }
        var gcd = -1;
        let remainder = 0;
        while(gcd == -1){
            remainder = dividend % divisor;
            if(remainder == 0) {
                gcd = divisor;
            } else {
                dividend = divisor;
                divisor = remainder;
            }
        }
        var hr = width / gcd;
        var vr = height / gcd;
        if(isWidth)
            return "(" + hr.toFixed(0) + ":" + vr.toFixed(0) + ")";
        else
            return "(" + vr.toFixed(0) + ":" + hr.toFixed(0) + ")";
    }
}

function ShowFacefixer(): boolean {
    if((store.params.post_processing || []).indexOf('GFPGAN') > -1)
        return true;
    if((store.params.post_processing || []).indexOf('CodeFormers') > -1)
        return true;
    return false;
}
</script>

<template>
    <el-form
            label-position="left"
            label-width="140px"
            :model="store"
            class="container"
            :rules="store.generateFormBaseRules"
            @submit.prevent
        >
            <div class="sidebar">
                <form-prompt-input />
                <form-seed />
                <form-select :label="lang.GetText(`llsampler`)"            prop="sampler"        v-model="store.params.sampler_name"       :options="availableSamplers"   :info ="lang.GetText(`ttsampler`)" />
                <form-slider :label="lang.GetText(`llbatchsize`)"         prop="batchSize"      v-model="store.params.n"                  :min="store.minImages"     :max="store.maxImages" />
                <form-slider :label="lang.GetText(`llsteps`)"              prop="steps"          v-model="store.params.steps"              :min="store.minSteps"      :max="store.maxSteps"      :info ="lang.GetText(`ttsteps`)" />
                <form-slider :label="lang.GetText(`llwidth`) + getAspectRatio(true)"              prop="width"          v-model="store.params.width"              :min="store.minWidth"      :max="store.maxWidth" :step="64"   :change="onDimensionsChange" />
                <form-slider :label="lang.GetText(`llheight`)"             prop="height"         v-model="store.params.height"             :min="store.minHeight"     :max="store.maxHeight" :step="64"   :change="onDimensionsChange" />
                <form-slider :label="lang.GetText(`llcfg`)"           prop="cfgScale"       v-model="store.params.cfg_scale"          :min="store.minCfgScale"   :max="store.maxCfgScale"   :step="0.5"  :info ="lang.GetText(`ttcfg`)" />
                <form-slider :label="lang.GetText(`llclipskip`)"         prop="clip_skip"      v-model="store.params.clip_skip"          :min="store.minClipSkip"   :max="store.maxClipSkip"   :info ="lang.GetText(`ttclipskip`)" />
                <form-model-select />
                <form-select :label="lang.GetText(`llpostprocessors`)"    prop="postProcessors" v-model="store.params.post_processing"            :options="store.availablePostProcessors" :info ="lang.GetText(`ttpostprocessor`)" multiple />
                <form-slider :label="lang.GetText(`llfacefixer`)"           prop="faceFixer"       v-model="store.params.facefixer_strength"          :min="0"   :max="1"   :step="0.1"  :info ="lang.GetText(`ttcfg`)"  v-if="ShowFacefixer()" />
                
                <el-row>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="tiling" :label="lang.GetText(`lltiling`)" :icon-on="Check" :icon-off="Close" v-model="store.params.tiling" :info ="lang.GetText(`tttiling`)" />
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="karras" :label="lang.GetText(`llkarras`)" :icon-on="Check" :icon-off="Close" v-model="store.params.karras" :info ="lang.GetText(`ttkarras`)" />
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="hirex_fix" :label="lang.GetText(`llhiresfix`)" :icon-on="Check" :icon-off="Close" v-model="store.params.hires_fix" :info ="lang.GetText(`tthiresfix`)" :disabled="(store.params.width || 0) > 512 && (store.params.height || 0) > 512 ? false : true" :disabled_info="lang.GetText(`tthiresfixx`)" />
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="trusted_worker" :label="lang.GetText(`lltrustedworker`)" :icon-on="Check" :icon-off="Close" v-model="store.trustedOnly" :info ="lang.GetText(`tttrustedworker`)" />
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="nsfw" :label="lang.GetText(`llnsfw`)" :icon-on="Check" :icon-off="Close" v-model="store.nsfw" :info ="lang.GetText(`ttnsfw`)" />
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="nsfw_censored" :label="lang.GetText(`llcensornsfw`)" :icon-on="Check" :icon-off="Close" v-model="store.censor_nsfw" :info ="lang.GetText(`ttcensornsfw`)" :disabled="!store.nsfw" :disabled_info="lang.GetText(`ttcensornsfw`)"/>
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="slow_workers" :label="lang.GetText(`llslowworker`)" :icon-on="Check" :icon-off="Close" v-model="store.slow_workers" :info ="lang.GetText(`ttslowworker`)" />
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <form-on-off-button prop="replacement_filter" :label="lang.GetText(`llreplacementfilter`)" :icon-on="Check" :icon-off="Close" v-model="store.replacement_filter" :info ="lang.GetText(`ttreplacementfilter`)" />
                    </el-col>
                </el-row>
            </div>
            <FormImagePreview />
        </el-form>
</template>