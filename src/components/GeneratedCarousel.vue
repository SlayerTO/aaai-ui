<script setup lang="ts">
import { useGeneratorStore } from '@/stores/generator';
import { useOptionsStore } from '@/stores/options';
import { useUIStore } from '@/stores/ui';
import { ElCarousel, ElCarouselItem, ElImage, ElDivider, ElScrollbar, ElIcon } from 'element-plus';
import { Back } from '@element-plus/icons-vue';
import { ref } from 'vue';
import { DEBUG_MODE } from "@/constants";
import ImageActions from './ImageActions.vue';

const store = useGeneratorStore();
const uiStore = useUIStore();
const optionStore = useOptionsStore();

const index = ref(0);
function onChange(newIndex: number) {
    index.value = newIndex;
    if (DEBUG_MODE) console.log(store.images[index.value])
}

function onDelete(id: number) {
    store.images.splice(store.images.findIndex(el => el.id === id), 1)
}
</script>

<template>
    <div style="position: relative; height: 100%; width: 100%">
        <div class="back-to-generation" v-if="store.generating" @click="uiStore.showGeneratedImages = false">
            <el-icon><Back /></el-icon>
            <span>Back to generation status</span>
        </div>
        <div class="carousel-container">
            <el-carousel
                class="carousel"
                :autoplay="optionStore.autoCarousel === 'Enabled'"
                trigger="click"
                indicator-position="outside"
                @change="onChange"
            >
                <el-carousel-item v-for="imageData in store.images" :key="imageData.seed">
                    <el-image
                        :src="imageData.image"
                        style="width: 100%; height: 100%;"
                        fit="scale-down"
                        @click="() => uiStore.activeModal = imageData.id"
                    ></el-image>
                </el-carousel-item>
            </el-carousel>
        </div>
        <div class="carousel-footer">
            <el-divider />
            <div style="display: flex; justify-content: center">
                <el-scrollbar>
                    <div style="white-space: nowrap;">
                        <ImageActions
                            :imageData="store.images[index]"
                            :on-delete="onDelete"
                        />
                    </div>
                </el-scrollbar>
            </div>
        </div>
    </div>
</template>

<style scoped>
.carousel-footer {
    position: absolute;
    bottom: 24px;
    width: 100%;
}

.carousel {
    --el-carousel-indicator-padding-vertical: 4px;
    width: 100%;
    margin: auto;
}

.carousel-container {
    display: flex;
    width: 100%;
    height: 100%;
    overflow-y: auto;
}

.back-to-generation {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--el-color-info);
    font-weight: 500;
    z-index: 1;
}

.back-to-generation:hover {
    cursor: pointer;
    text-decoration: underline;
}

@media only screen and (max-width: 1280px) {
    .carousel-footer {
        bottom: 5px;
    }
    .carousel-footer > .el-divider {
        margin: 5px 0;
    }
}
</style>