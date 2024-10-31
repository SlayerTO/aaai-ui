<script setup lang="ts">
import {
    ElRow,
    ElCol,
    ElCard,
    ElEmpty,
    ElIcon,
    ElTable,
    ElTableColumn
} from "element-plus";
import {
    Money,
    Aim,
    Picture,
    Lock
} from "@element-plus/icons-vue"
import DataLabel from '../components/DataLabel.vue'
import WorkerEditor from '../components/WorkerEditor.vue';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { computed } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import { useUserStore } from '@/stores/user';
import BaseLink from '@/components/BaseLink.vue';
import { useLanguageStore } from '@/stores/i18n';
import Menu from '../views/Menu.vue';
import { useOptionsStore } from '@/stores/options';
const lang = useLanguageStore();
const breakpoints = useBreakpoints(breakpointsTailwind);

const breakLabels = breakpoints.smallerOrEqual('xl');
const breakLabelsMore = breakpoints.smallerOrEqual('lg');

const dashStore = useDashboardStore();
const userStore = useUserStore();

// Max: 24 for each col
const spanLabels = computed(() => breakLabels.value ? breakLabelsMore.value ? 20 : 10 : 5);
const spanAmount = computed(() => breakLabels.value ? 24 : 12);

const sortChange = function(column: any) {
    dashStore.leaderboardOrderProp = column.prop;
    dashStore.leaderboardOrder = column.order;
    dashStore.updateLeaderboard();
}

const signedIn = computed(() => userStore.apiKey != '0000000000' && userStore.apiKey != '');
</script>
<template>
    <Menu />
    <div class="dashboard">
        <div>
            <div v-if="signedIn">
                <div class="dashboard-title">{{lang.GetText(`dashboardtext1`)}} {{dashStore.user.username}}</div>
                <el-row v-if="useOptionsStore().useAIEUHorde === 'Enabled'" :gutter="breakLabels ? 0 : 20" justify="center" style="width: 100%; margin-bottom: 2rem;">
                    <el-col :span="spanLabels" class="label"><data-label style="width: 100%" :icon="Money"   :label="lang.GetText(`llkudosAA`)"           :content="dashStore.getCurrentCurrency"                       color="var(--el-color-success)" /></el-col>
                    <el-col :span="spanLabels" class="label"><data-label style="width: 100%" :icon="Picture" :label="lang.GetText(`llrequestedAA`)"       :content="dashStore.getRequestedImages" color="var(--el-color-danger)"  /></el-col>
                    <el-col :span="spanLabels" class="label"><data-label style="width: 100%" :icon="Aim"     :label="lang.GetText(`llgeneratedAA`)"       :content="dashStore.getFullfilledImages" color="var(--el-color-primary)" /></el-col>
                </el-row>         
                <el-row v-else :gutter="breakLabels ? 0 : 20" justify="center" style="width: 100%; margin-bottom: 2rem;">
                    <el-col :span="spanLabels" class="label"><data-label style="width: 100%" :icon="Money"   :label="lang.GetText(`llkudosDB`)"           :content="dashStore.getCurrentCurrency"                       color="var(--el-color-success)" /></el-col>
                    <el-col :span="spanLabels" class="label"><data-label style="width: 100%" :icon="Picture" :label="lang.GetText(`llrequestedDB`)"       :content="dashStore.getRequestedImages" color="var(--el-color-danger)"  /></el-col>
                    <el-col :span="spanLabels" class="label"><data-label style="width: 100%" :icon="Aim"     :label="lang.GetText(`llgeneratedDB`)"       :content="dashStore.getFullfilledImages" color="var(--el-color-primary)" /></el-col>
                </el-row>          
            </div>
            <div v-else>
                <div class="api-key-required"><el-icon :size="30" style="margin-right: 10px"><Lock /></el-icon>{{lang.GetText(`dashrequiresapikey`)}}</div>
            </div>
            <el-row :gutter="breakLabels ? 0 : 20" justify="space-around" style="margin-bottom: 2rem;">
                <el-col :span="spanAmount" class="label">
                    <el-card style="margin-bottom: 10px;">
                        <template #header>
                            <strong v-if="useOptionsStore().useAIEUHorde === 'Enabled'">Artifical Art {{lang.GetText(`dashhordeperformance`)}}</strong>
                            <strong v-else>{{lang.GetText(`dashhordeperformance`)}}</strong>
                        </template>
                        <div v-html="lang.GetText(`DashboardHordeImages`, {'%queued_requests%': (dashStore.performance.queued_requests || 0).toString(), '%queued_megapixelsteps%': (dashStore.performance.queued_megapixelsteps || 0).toString(), '%worker_count%': (dashStore.performance.worker_count || 0).toString(), '%thread_count%': (dashStore.performance.thread_count || 0).toString()})"></div>
                        <div v-html="lang.GetText(`DashboardHordeInterrogator`, {'%queued_forms%': (dashStore.performance.queued_forms || 0).toString(), '%interrogator_count%': (dashStore.performance.interrogator_count || 0).toString(), '%interrogator_thread_count%': (dashStore.performance.interrogator_thread_count || 0).toString()})"></div>
                        <div v-html="lang.GetText(`DashboardHordeInThePast`, {'%past_minute_megapixelsteps%': dashStore.performance.past_minute_megapixelsteps})"></div>
                    </el-card>
                </el-col>
                <el-col :span="spanAmount" class="label">
                    <el-card v-if="signedIn">
                        <template #header><strong>{{lang.GetText(`dashyourworkers`)}}</strong></template>
                        <div class="user-workers" v-if="dashStore.userWorkers.length !== 0">
                            <WorkerEditor
                                v-for="worker in dashStore.userWorkers"
                                :key="worker.id"
                                :worker="worker"
                            />
                        </div>
                        <div v-else><el-empty :description="lang.GetText(`dashnoworkersfound`)" /></div>
                    </el-card>
                    <div v-else>
                        <div class="api-key-required"><el-icon :size="30" style="margin-right: 10px"><Lock /></el-icon>{{lang.GetText(`dashrequiresapikey2`)}}</div>
                    </div>
                </el-col>
            </el-row>
        </div>
    </div>

  <div class="about">
    <div class="about-content">
        {{lang.GetText(`abouttext1`)}}<br><br>
        {{lang.GetText(`abouttext2`)}} <BaseLink href="https://discord.gg/ugEqPP5wMT">Discord!</BaseLink><br><br>
        {{lang.GetText(`abouttext3`)}} <BaseLink :router="false" href="https://ko-fi.com/artificialart">Ko-Fi!</BaseLink>
        {{lang.GetText(`abouttext3b`)}}<br><br>
        <hr><br/>
        {{lang.GetText(`abouttext5`)}} <BaseLink :router="false" href="https://icanhazdadjoke.com/">icanhazdadjoke.com</BaseLink><br><br>
        {{lang.GetText(`abouttext6`)}} <BaseLink :router="false" href="https://aqualxx.github.io/stable-ui/">aqualxx#5004</BaseLink><br><br><br/><br/>
    </div>
  </div>
</template>

<style scoped>
.user-workers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    grid-gap: 10px;
    width: 100%;
}

.dashboard-title {
    font-size: 50px;
    margin-bottom: 1rem;
    text-align: center;
}

.api-key-required {
    font-size: 20px;
    margin-bottom: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
}

.center-both-absolute {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.leaderboard {
    width: 100%;
}

.news {
    height: 300px;
}

.news > div > div > p {
    margin-top: 0
}

@media only screen and (max-width: 1000px) {
    .dashboard-title {
        font-size: 40px;
    }
}

@media only screen and (max-width: 1280px) {
    .label {
        margin-bottom: 5px
    }
}
h3, h1 {
    margin-bottom: 0;
}

.about {
    width: 100%;
    font-size: 1.1rem;
    display: flex;
    justify-content: center;
}

.about-content {
    width: 60%
}

@media only screen and (max-width: 1000px) {
    .about-content {
        width: 80%;
    }
}

@media only screen and (max-width: 700px) {
    .about-content {
        width: 100%;
    }
}
</style>
