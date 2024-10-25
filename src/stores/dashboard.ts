import type { UserDetailsStable, HordePerformanceStable, WorkerDetailsStable } from "@/types/stable_horde";
import { defineStore } from "pinia";
import { ref } from 'vue';
import { useWorkerStore } from "./workers";
import { useUserStore } from "./user";
import { POLL_DASHBOARD_INTERVAL, POLL_USERS_INTERVAL, DEBUG_MODE } from "@/constants";
import { validateResponse } from "@/utils/validate";
import { BASE_URL_AI_STABLE, BASE_URL_EU_STABLE } from "@/constants";
import { useLanguageStore } from '@/stores/i18n';
import { useOptionsStore } from '@/stores/options';

const formatter = Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2});


export type AAAIVideoPerformance = {
    success?: boolean;
    Queue?: number;
    QueuedFrames?: number;
    TotalGenerated?: number;
    TotalFrames?: number;
    TotalUsers?: number;
    DayGenerated?: number;
    DayFrames?: number;
    DayUsers?: number;
    HourGenerated?: number;
    HourFrames?: number;
    HourUsers?: number;
    msg?: string;
  };

export const useDashboardStore = defineStore("dashboard", () => {
    const lang = useLanguageStore();
    const settings = useOptionsStore();
    const user = ref<UserDetailsStable>({});
    const userWorkers = ref<WorkerDetailsStable[]>([]);
    const performance = ref<HordePerformanceStable>({});
    const performanceVideo = ref<AAAIVideoPerformance>({});
    const users = ref<UserDetailsStable[]>([]);
    const leaderboard = ref<{id: number; name: string; kudos: string; mps: number;}[]>([]);
    const leaderboardOrderProp = ref("kudos");
    const leaderboardOrder = ref("descending");
    const news = ref<{date_published: string; newspiece: string; importance: string;}[]>([]);
    
    /**
     * Finds the user based on API key
     * */ 
    async function updateDashboard() {
        const userStore = useUserStore();

        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/find_user`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/find_user`;
        }      
        const response = await fetch(fetchUri, {
            headers: {
                apikey: userStore.apiKey
            }
        });
        const resJSON: UserDetailsStable = await response.json();
        //if (!validateResponse(response, resJSON, 200, "Failed to find user by API key")) return false;
        user.value = resJSON;
        getHordePerformance();
        getAAAIVideoPerformance();
        
        if (userStore.apiKey === '0000000000' || userStore.apiKey === '' || response.status !== 200) return;
        getAllUserWorkers();
    }

    /**
     * Finds the user's stale workers
     * */ 
    async function getStaleWorker(workerID: string) {
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/workers/${workerID}`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/workers/${workerID}`;
        }      
        const response = await fetch(fetchUri);
        const resJSON = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`dashfailedtofindapi`))) return false;
        return resJSON;
    }

    /**
     * Finds all of the user's workers
     * */ 
    async function getAllUserWorkers() {
        if (DEBUG_MODE) console.log("Attempting to get all user workers...")
        const workerStore = useWorkerStore();
        if (user.value.worker_ids == undefined) return [];
        const workers: WorkerDetailsStable[] = [];
        for (let i = 0; i < user.value.worker_ids?.length; i++) {
            const workerID = user.value.worker_ids[i];
            const worker = workerStore.workers.find(worker => worker.id === workerID);
            const workerData = worker || await getStaleWorker(workerID);
            workers.push(workerData);
            if (DEBUG_MODE) console.log(worker ? "Got online user worker..." : "Got stale user worker...", workerData)
        }
        if (DEBUG_MODE) console.log("Got workers!", workers)
        userWorkers.value = workers;
    }

    async function updateUsers() {
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/users`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/users`;
        }      
        const response = await fetch(fetchUri);
        const resJSON = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`dashfailedtoupdate`))) return false;
        users.value = resJSON;
        updateLeaderboard();
    }

    async function getAAAIVideoPerformance() {
        const response = await fetch(`https://api.artificial-art.eu/video/stats`);
        const resJSON = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`dashfailedtogetaaai`))) return false;
        performanceVideo.value = resJSON;

    }

    async function getHordePerformance() {
        var fetchUri = `${BASE_URL_AI_STABLE}/api/v2/status/performance`;
        if(settings.useAIEUHorde === 'Enabled') {
            fetchUri = `${BASE_URL_EU_STABLE}/api/v2/status/performance`;
        }      
        const response = await fetch(fetchUri);
        const resJSON = await response.json();
        if (!validateResponse(response, resJSON, 200, lang.GetText(`dashfailedtoget`))) return false;
        performance.value = resJSON;
    }

    async function updateLeaderboard() {
        function formatUserForLeaderboard(index: number, user: UserDetailsStable) {
            return {
                id: index + 1,
                name: user.username as string,
                kudos: formatter.format(Math.floor(Object.values(user.kudos_details as any).reduce((a: any, b: any) => a + b) as number)),
                mps: Math.floor(user.contributions?.megapixelsteps as number)
            }
        }

        const sortedUsers: UserDetailsStable[] = [...users.value].sort((a: UserDetailsStable, b: UserDetailsStable) => {
            let cmpA = 0;
            let cmpB = 0;
            if (leaderboardOrderProp.value === "kudos") {
                cmpA = Object.values(a.kudos_details as any).reduce((a: any, b: any) => a + b) as number;
                cmpB = Object.values(b.kudos_details as any).reduce((a: any, b: any) => a + b) as number;
            }
            if (leaderboardOrderProp.value === "mps") {
                cmpA = a.contributions?.megapixelsteps as number;
                cmpB = b.contributions?.megapixelsteps as number;
            }
            if (leaderboardOrder.value === "ascending") return cmpA - cmpB;
            return leaderboardOrder.value === "ascending" ? cmpA - cmpB : cmpB - cmpA;
        })
        const yourRanking = sortedUsers.map(el => el.username).indexOf(user.value.username);

        for (let i = 0; i < Math.min(10, sortedUsers.length); i++) {
            leaderboard.value[i] = formatUserForLeaderboard(i, sortedUsers[i]);
        }

        if (sortedUsers[yourRanking]) {
            leaderboard.value[11] = formatUserForLeaderboard(yourRanking, sortedUsers[yourRanking]);
        }
    }

    function performanceTable() {
        const tableData = [
          {
            type: lang.GetText('ChaosPerformanceLastHour'),
            videos: Intl.NumberFormat('en-US').format(performanceVideo.value.HourGenerated || 0),
            frames: Intl.NumberFormat('en-US').format(performanceVideo.value.HourFrames || 0),
            uesers: Intl.NumberFormat('en-US').format(performanceVideo.value.HourUsers || 0),
          },
          {
            type: lang.GetText('ChaosPerformanceLastDay'),
            videos: Intl.NumberFormat('en-US').format(performanceVideo.value.DayGenerated || 0),
            frames: Intl.NumberFormat('en-US').format(performanceVideo.value.DayFrames || 0),
            uesers: Intl.NumberFormat('en-US').format(performanceVideo.value.DayUsers || 0),
          },
          {
            type: lang.GetText('ChaosPerformanceTotal'),
            videos: Intl.NumberFormat('en-US').format(performanceVideo.value.TotalGenerated || 0),
            frames: Intl.NumberFormat('en-US').format(performanceVideo.value.TotalFrames || 0),
            uesers: Intl.NumberFormat('en-US').format(performanceVideo.value.TotalUsers || 0),
          },
        ];
        return tableData;
    }

    updateDashboard();
    updateUsers();
    setInterval(updateDashboard, POLL_DASHBOARD_INTERVAL * 1000);
    setInterval(updateUsers, POLL_USERS_INTERVAL * 1000);

    return {
        // Variables
        user,
        userWorkers,
        performance,
        performanceVideo,
        users,
        leaderboard,
        leaderboardOrderProp,
        leaderboardOrder,
        news, 
        // Actions
        performanceTable,
        updateDashboard,
        getAllUserWorkers,
        updateLeaderboard,
        updateUsers,
        getHordePerformance,
        getAAAIVideoPerformance
    };
});
