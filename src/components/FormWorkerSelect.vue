<script setup lang="ts">
import FormSelect from './FormSelect.vue';
import { useOptionsStore } from '@/stores/options';
import { useWorkerStore } from '@/stores/workers';
import { useLanguageStore } from '@/stores/i18n';
import { DEBUG_MODE } from "@/constants";
const lang = useLanguageStore();
const store = useOptionsStore();
const workerStore = useWorkerStore();

workerStore.updateWorkers();
if (DEBUG_MODE) console.log("Attempting to update worker store from FormWorkerSelect...")

</script>

<template>
    <form-select
        :label="lang.GetText(`llusespecificworker`)"
        prop="useWorker"
        v-model="store.useWorkers"
        :options="[...workerStore.sortedByNameWorkers.map(el => {return {label: el.name, value: el.id}})]"
        filterable
        multiple
        placement="top"
        class="multi-model-select"
        :multiplelimit="5"
    >
    </form-select>
</template>

<style>
.multi-model-select > .el-form-item__content > .el-select {
    min-width: 80%
}
</style>