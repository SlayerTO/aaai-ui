<script setup lang=ts>
import { ref } from "vue";
import {
    ElButton,
    ElDialog,
    ElForm,
    ElSwitch,
    ElFormItem,
    ElInput,
    ElMessageBox
} from 'element-plus';
import WorkerBox from './WorkerBox.vue';
import FormSelect from './FormSelect.vue';
import type { WorkerDetailsStable } from "@/types/stable_horde";
import { useWorkerStore } from "@/stores/workers";
import { useUserStore } from "@/stores/user";
import { validateResponse } from "@/utils/validate";
import { BASE_URL_AI_STABLE, BASE_URL_EU_STABLE, DEBUG_MODE } from "@/constants";
import { useLanguageStore } from '@/stores/i18n';
const lang = useLanguageStore();
import { useOptionsStore } from '@/stores/options';

const settings = useOptionsStore();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps<{
    worker: WorkerDetailsStable;
}>();

const workerStore = useWorkerStore();
const userStore = useUserStore();

async function updateWorkerOptions() {
    
    var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/workers/${props.worker?.id}`;
    if(settings.useAIEUHorde === 'Enabled') {
        fetchUri = `${BASE_URL_EU_STABLE}/api/v2/workers/${props.worker?.id}`;
    }    
    const response = await fetch(fetchUri, {
        method: "PUT",
        body: JSON.stringify(workerOptionsChange.value),
        headers: {
            "Content-Type": "application/json",
            apikey: userStore.apiKey
        }
    });
    const resJSON = await response.json();
    if (response.status === 403) {
        if (DEBUG_MODE) console.log("Attempting to update worker store from updateWorkerOptions Invalid JSON...")
        workerStore.updateWorkers()
        return resJSON;
    }
    if (response.status === 500) {
        // Hack cause Horder is always reporting 500,
        // if paused argument is added that is not the case but
        // worker name is not changeable anymore due to
        // paused being only modifyable as an moderator
        return;
    }
    if (!validateResponse(response, resJSON, 200, lang.GetText(`editfailedtomodifyworker`) )) return false;
    if (DEBUG_MODE) console.log("Attempting to update worker store from updateWorkerOptions Valid Response...")
    workerStore.updateWorkers()
    return resJSON;
}

let deleteTimer = ref<any>(undefined);

function deleteWorker() {
    ElMessageBox.confirm(
        lang.GetText(`editpermanentlydelete`),
        lang.GetText(`editdeleteworker?`),
        {
            confirmButtonText: lang.GetText(`lldelete`),
            cancelButtonText: lang.GetText(`cancel`),
            type: 'warning',
        }
    ).then(() => {
        deleteTimer.value = setTimeout(async () => {
            var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/workers/${props.worker?.id}`;
            if(settings.useAIEUHorde === 'Enabled') {
                fetchUri = `${BASE_URL_EU_STABLE}/api/v2/workers/${props.worker?.id}`;
            }    
            const response = await fetch(fetchUri, {
                method: "DELETE",
                headers: {
                    apikey: userStore.apiKey
                }
            });
            const resJSON = await response.json();
            if (!validateResponse(response, resJSON, 200, lang.GetText(`editfailedtodeleteworker`))) return false;
            if (DEBUG_MODE) console.log("Attempting to update worker store from deleteWorker Valid Response...")
            workerStore.updateWorkers();
            dialogOpen.value = false;
        }, 60 * 1000)
    })
}

function cancelDeleteWorker() {
    clearTimeout(deleteTimer.value);
    deleteTimer.value = undefined;
}

const dialogOpen = ref(false);
const workerOptionsChange = ref({
    maintenance: props.worker?.maintenance_mode,
    maintenance_msg: "",
    info: props.worker.info,
    name: props.worker.name,
    team: props.worker.team?.id === null ? '' : props.worker.team?.id
})
</script>

<template>
    <WorkerBox
        v-if="worker != undefined"
        :worker="worker"
    >
        <template #header>
            <el-button @click="dialogOpen = true">Edit Worker</el-button>
            <el-dialog
                v-model="dialogOpen"
                :title="worker.name"
                style="height: 500px; width: 600px;"
                align-center
            >
                <el-form label-width="140px" :model="workerOptionsChange" label-position="left" @submit.prevent>
                    <el-form-item :label="lang.GetText(`editchangename`)">
                        <div style="font-size: 13px; word-break: keep-all;">{{lang.GetText(`editmakesuretostop`)}}</div>
                        <el-input
                            v-model="workerOptionsChange.name"
                            :placeholder="lang.GetText(`editenternewname`)"
                            style="width: 80%; min-width: 200px"
                        />
                        <el-button @click="updateWorkerOptions">{{lang.GetText(`editsubmit`)}}</el-button>
                    </el-form-item>
                    <el-form-item :label="lang.GetText(`editinfo`)">
                        <el-input
                            v-model="workerOptionsChange.info"
                            :autosize="{ minRows: 2, maxRows: 10 }"
                            clearable
                            resize="none"
                            type="textarea"
                            style="width: 80%; word-break:keep-all; min-width: 200px;"
                            maxlength="1000"
                            :placeholder="lang.GetText(`editenternewinfo`)"
                        />
                        <el-button @click="updateWorkerOptions">{{lang.GetText(`editsubmit`)}}</el-button>
                    </el-form-item>
                    <FormSelect
                        :label="lang.GetText(`editteam`)"
                        prop="team"
                        v-model="workerOptionsChange.team"
                        :options="[
                            {label: lang.GetText(`editnone`), value: ''},
                            ...workerStore.teams.map(el => {return {label: el.name, value: el.id}})
                        ]"
                        :change="updateWorkerOptions"
                    />
                    <el-form-item :label="lang.GetText(`editmaintenancemode`)">
                        <el-switch v-model="workerOptionsChange.maintenance" @change="updateWorkerOptions" />
                    </el-form-item>
                    <el-form-item :label="lang.GetText(`editdeleteworker`)">
                        <el-button type="danger" v-if="deleteTimer == undefined" @click="deleteWorker">{{lang.GetText(`editremove`)}}</el-button>
                        <el-button type="danger" v-if="deleteTimer != undefined" @click="cancelDeleteWorker">{{lang.GetText(`editcancelremove`)}}</el-button>
                    </el-form-item>
                </el-form>
            </el-dialog>
        </template>
    </WorkerBox>
</template>