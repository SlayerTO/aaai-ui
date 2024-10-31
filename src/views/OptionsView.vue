<script setup lang="ts">
import { useLanguageStore } from '@/stores/i18n';
import {
    ElForm, ElRow,
    ElFormItem,
    ElInput,
    ElButton,
    type UploadFile,
    ElIcon,
    ElUpload,
    vLoading
} from 'element-plus';
import {
    UploadFilled,
    Download
} from '@element-plus/icons-vue';
import { useOptionsStore } from '@/stores/options';
import { useUserStore } from '@/stores/user';
import FormSlider from '../components/FormSlider.vue';
import FormSelect from '../components/FormSelect.vue';
import FormRadio from '../components/FormRadio.vue';
import { ref } from 'vue';
import { useOutputStore, type ImageData } from '@/stores/outputs';
import { downloadMultipleWebp } from '@/utils/download';
import { db } from '@/utils/db';
import FormWorkerSelect from '../components/FormWorkerSelect.vue';
import { useTagsStore } from '@/stores/tags';
import Menu from '../views/Menu.vue';

const tagStore = useTagsStore();
const store = useOptionsStore();
const outputsStore = useOutputStore();
const userStore = useUserStore();
const lang = useLanguageStore();

const options = [
    {
        value: 'dark',
        label: lang.GetText(`lldark`),
    }, {
        value: 'light',
        label: lang.GetText(`lllight`),
    }, {
        value: 'orange',
        label: lang.GetText(`llorange`),
    }, {
        value: 'purple',
        label: lang.GetText(`llpurple`),
    }, {
        value: 'green',
        label: lang.GetText(`llgreen`),
    }
]

const PictureTypes = ["WEBP", "PNG", "JPG", "JPEG"];

const fileList = ref([]);
const upload = ref();

async function handleChange(uploadFile: UploadFile) {
    outputsStore.importFromZip(uploadFile);
    upload.value!.clearFiles();
}

async function bulkDownload() {
    const selectedOutputs = await db.outputs.toArray();
    downloadMultipleWebp((selectedOutputs.filter(el => el != undefined) as ImageData[]))
}
async function onTagsChange() {
    if (tagStore.tagsTypes[tagStore.currentTagsType].tags.length !== 0) return;
    tagStore.loadTags(tagStore.currentTagsType);
}
</script>
<template>
    <Menu />
    <el-form
        class="container"
        label-position="top"
        label-width="140px"
        @submit.prevent
    >
        <el-row justify="space-around">
            <el-column>
                <el-form-item v-if="store.useAIEUHorde === 'Disabled'" :label="lang.GetText(`engapikeyDB`)" prop="apiKeyDB">
                    <el-input v-model="userStore.apikeyDB" type="password" :placeholder="lang.GetText(`engenterapikey`)" autocomplete="off" class="apiKeyDB" show-password />
                    <el-button class="anon" @click="userStore.setAnon()">Anon?</el-button>
                    <a href="https://aihorde.net/register" target="_blank"><el-button class="register">Register</el-button></a>
                </el-form-item>
                
                <form-radio  label="Artifical Arts Horde" prop="useAIEUHorde" v-model="store.useAIEUHorde" :options="['Enabled', 'Disabled']" />
                
                <el-form-item v-if="store.useAIEUHorde === 'Enabled'" :label="lang.GetText(`engapikeyAA`)" prop="apiKeyAA">
                    <el-input v-model="userStore.apiKeyAA" type="password" :placeholder="lang.GetText(`engenterapikey`)" autocomplete="off" class="apiKeyAA" show-password />
                    <el-button class="anon" @click="userStore.setAnon()">Anon?</el-button>
                    <a href="https://libertas.zapto.org/register" target="_blank"><el-button class="register">Register</el-button></a>
                </el-form-item>
        
                <form-worker-select />
        
                <form-slider :label="lang.GetText(`llimagesperpage`)" prop="pageSize" v-model="store.pageSize" :min="10" :max="50" :step="5" :disabled="store.pageless === 'Enabled'" />
        

                <form-radio  :label="lang.GetText(`llpageless`)" prop="pageless" v-model="store.pageless" :options="['Enabled', 'Disabled']" />

                <form-radio  :label="lang.GetText(`llcarouselauto`)" prop="autoCarousel" v-model="store.autoCarousel" :options="['Enabled', 'Disabled']" />

                <form-radio :label="lang.GetText(`lllargervalues`)" prop="allowLargerParams" v-model="store.allowLargerParams" :options="['Enabled', 'Disabled']" :info="lang.GetText(`ttlargervalues`)" :disabled="userStore.apiKey === '0000000000' || userStore.apiKey === ''" />
        
                <form-radio  :label="lang.GetText(`llsharelaion`)" prop="shareWithLaion" v-model="store.shareWithLaion" :options="['Enabled', 'Disabled']" :info="lang.GetText(`ttsharelaion`)" :disabled="userStore.apiKey === '0000000000' || userStore.apiKey === ''" />
            </el-column>
            <el-column>
                <form-select :label="lang.GetText(`lllanguageswitch`)" prop="tagLanguage" v-model="lang.currentLanguage" :options="lang.possibleLanguage" :info="lang.GetText(`ttlanguageswitchinfo`)" />

                <form-select :label="lang.GetText(`lltagautocomplete`)" prop="tagAutocomplete" v-model="tagStore.currentTagsType" :options="tagStore.possibleTags" @change="onTagsChange" v-loading="tagStore.tagsLoading" :info="lang.GetText(`tttagautocomplete`)" />

                <form-select :label="lang.GetText(`llcolormode`)" prop="colorMode" v-model="store.colorMode" :options="options" />

                <form-select :label="lang.GetText(`llfileformat`)" prop="downloadFileFormat" v-model="store.pictureDownloadType" :options="PictureTypes" />

                <el-form-item :label="lang.GetText(`llexportzip`)">
                    <el-button :icon="Download" @click="bulkDownload()">{{ lang.GetText('DownloadNImages', {'%COUNT%': outputsStore.outputsLength.toString()}) }}</el-button>
                </el-form-item>
        
                <el-form-item :label="lang.GetText(`llimportzip`)">
                    <el-upload drag ref="upload" :auto-upload="false" @change="handleChange" :file-list="fileList" :limit="1" multiple > <el-icon :size="100"><upload-filled /></el-icon> <div>Drop file here OR <em>click to upload</em></div></el-upload>
                </el-form-item>
                
                <form-radio  :label="lang.GetText(`llmetadata`)" prop="zipMetaData" v-model="store.zipMetaData" :options="['Enabled', 'Disabled']" :info="lang.GetText(`ttmetadata`)" />
            </el-column>
        </el-row>
    </el-form>
</template>

<style scoped>
.anon {
    width: 80px
}

.el-tab-pane {
    max-width: 600px;
}

h2 {
    margin-top: 0
}

.apikey {
    width: calc(100% - 80px)
}

@media only screen and (max-width: 1000px) {
    .anon {
        width: 80px
    }

    .apikey {
        width: 100%
    }
}
</style>