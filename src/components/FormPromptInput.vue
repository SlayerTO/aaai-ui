<script setup lang="ts">
import {
    ElButton,
    ElTooltip,
    ElSelect,
    ElOption,
    ElSwitch,
} from 'element-plus';
import {
    Plus,
    Delete,
    Check,
    Clock,
    FolderChecked,
    FolderOpened,
    MagicStick,
    TrendCharts
} from '@element-plus/icons-vue';
import { useGeneratorStore } from '@/stores/generator';
import { useTagsStore, type TagList } from '@/stores/tags';
import FormInput from './FormInput.vue';
import DialogList from './DialogList.vue';
import Star12Filled from './icons/Star12Filled.vue';
import Star12Regular from './icons/Star12Regular.vue';
import { computed, ref } from 'vue';
import { useUIStore } from '@/stores/ui';
import { formatDate } from '@/utils/format';
import { useLanguageStore } from '@/stores/i18n';
import { onKeyStroke } from '@vueuse/core';
const lang = useLanguageStore();
const store = useGeneratorStore();
const tagStore = useTagsStore();
const uiStore = useUIStore();
const promptLibrary = ref(false);
const selectStyle = ref(false);

function getStyle(key: string) {
    const style = store.styles[key as any];
    const [prompt, negativePrompt] = style.prompt.split("###");
    return {
        prompt,
        promptSplit: prompt.replace("{np}", "").split("{p}"),
        negativePrompt,
        negativePromptSplit: negativePrompt ? negativePrompt.split("{np}") : undefined,
        model: style.model,
    }
}

function getPromptFromHistory(prompt: string) {
    return store.promptHistory.find(el => el.prompt === prompt);
}

function handleUseStyle(style: string) {
    const { prompt, negativePrompt, model } = getStyle(style);
    store.prompt = prompt.replace("{p}", store.prompt).replace("{np}", "");
    if (negativePrompt) store.negativePrompt = negativePrompt.replace("{np}", store.negativePrompt);
    if (store.filteredAvailableModelsGrouped.map(el => el?.options.map(el2 => el2.value)).find(el => el?.includes(model))) {
        store.selectedModel = model;
    } else {
        uiStore.raiseWarning(lang.GetText(`Warning: style's model isn't available.`), false)
    }
}

function handleFavourite(prompt: string) {
    const promptHistoryPrompt = store.promptHistory.findIndex(el => el.prompt === prompt);
    if (promptHistoryPrompt === -1) return;
    store.promptHistory[promptHistoryPrompt].starred = !store.promptHistory[promptHistoryPrompt].starred;
}

const sortedPromptHistory = computed(
    () => store.promptHistory
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .sort((a, b) => Number(b.starred) - Number(a.starred))
        .map(el => el.prompt || el)
)

const negativePromptLibrary = ref(false);

const searchStyle = ref("");
const showDetails = ref(false);
const nsfwBong = ref(false);
const showNsfwBong = computed(() => nsfwBong.value);

const nsfwREGEX = new RegExp('girl|\\bboy\\b|student|\\byoung\\b|lit[tl]le|\\blil\\b|small|tiny')
function showNsfwNotification(event: string) {
  if (nsfwREGEX.test(event.toLowerCase())) {
    nsfwBong.value = true;
  } else {
    nsfwBong.value = false;
  }
}
const promptFocused = ref(false);
const selectedIndex = ref(0);
const maxTags = 8;
const currentWord = computed(() => store.prompt.split(' ')[store.prompt.split(' ').length - 1]);
const filteredTags = computed(() => {
    const tags = tagStore.currentTags.tags;
    const idx = binarySearch(tags, currentWord.value);
    if (idx < 0) {
        return [];
    }
    const filtered = [tags[idx]];
    for (let i = idx + 1; i < tags.length; i++) {
        const el = tags[i];
        if (el.name.startsWith(currentWord.value)) {
            filtered.push(el);
        } else {
            break;
        }
    }
    const numberFormatter = Intl.NumberFormat(undefined, { notation: "compact" });
    return filtered.sort((a,b) => b.postCount - a.postCount).slice(0, maxTags).map(el => ({ ...el, postCount: numberFormatter.format(el.postCount) }));
})
function binarySearch(arr: TagList[], target: string) {
    let low = 0;
    let high = arr.length - 1;
    let closestIdx = -1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const cmp = arr[mid].name.localeCompare(target);
        if (cmp <= 0) {
            closestIdx = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return closestIdx;
}
function pushTag(index: number) {
    const selectedTag = filteredTags.value[index].name;
    const a = store.prompt.split(currentWord.value);
    a.pop();
    store.prompt = a.join(currentWord.value) + selectedTag + ", ";
}
onKeyStroke("ArrowDown", (e) => {
    if (!promptFocused.value || tagStore.currentTags.tags.length === 0) return;
    e.preventDefault();
    if (selectedIndex.value >= maxTags - 1) return;
    selectedIndex.value++;
});
onKeyStroke("ArrowUp", (e) => {
    if (!promptFocused.value || tagStore.currentTags.tags.length === 0) return;
    e.preventDefault();
    if (selectedIndex.value <= 0) return;
    selectedIndex.value--;
});
onKeyStroke("Enter", (e) => {
    if (!promptFocused.value || tagStore.currentTags.tags.length === 0) return;
    e.preventDefault();
    pushTag(selectedIndex.value);
    selectedIndex.value = 0;
});
</script>

<template>
    <div id="warning" v-if="store.selectedModelData.nsfw && showNsfwBong">
        <svg height="50" viewBox="0 0 512 512" width="50" xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M449.07,399.08,278.64,82.58c-12.08-22.44-44.26-22.44-56.35,0L51.87,399.08A32,32,0,0,0,80,446.25H420.89A32,32,0,0,0,449.07,399.08Zm-198.6-1.83a20,20,0,1,1,20-20A20,20,0,0,1,250.47,397.25ZM272.19,196.1l-5.74,122a16,16,0,0,1-32,0l-5.74-121.95v0a21.73,21.73,0,0,1,21.5-22.69h.21a21.74,21.74,0,0,1,21.73,22.7Z"/></svg>
        <div class="wtext">
            <strong>{{lang.GetText(`warning`)}}</strong>{{lang.GetText(`warningbadwords`)}}
        </div>
        <div class="clear">&nbsp;</div>
    </div>
    <form-input :change="showNsfwNotification" prop="prompt" :spanWidth=3 v-model="store.prompt" :autosize="{ minRows: 2 }" resize="vertical" type="textarea" :placeholder="lang.GetText(`promptplaceholder`)" label-position="top" label-style="justify-content: space-between; width: 100%;" @focus="promptFocused = true" @blur="promptFocused = false">
        <template #label>
            <div>{{lang.GetText(`llprompt`)}}</div>
            <el-tooltip :content="lang.GetText(`lladdtrigger`)" placement="top" v-if="store.selectedModelData?.trigger">
                <el-button v-if="store.selectedModelData.trigger.length === 1" @click="() => store.addDreamboothTrigger()" :icon="Plus" class="trigger-select" />
                <el-select v-else class="trigger-select" @change="store.addDreamboothTrigger">
                    <el-option
                        v-for="item in store.selectedModelData?.trigger"
                        :key="item"
                        :label="item"
                        :value="item"
                    />
                </el-select>
            </el-tooltip>
        </template>
        <template #inline>
            <div style="margin-top: -3px; position: relative">
                <div
                    style="position: absolute; z-index: 5; margin-top: 3px;"
                    v-if="tagStore.currentTags.tags.length !== 0 && promptFocused"
                    @focus="promptFocused = true"
                    @blur="promptFocused = false"
                >
                    <div
                        v-for="(tag, index) in filteredTags"
                        :key="tag.name"
                        class="tag-select"
                        :style="{
                            backgroundColor: selectedIndex === index ? `rgb(100, 100, 100)` : index % 2 === 0 ? `rgb(48, 48, 48)` : `rgb(58, 58, 58)`
                        }"
                        @mousedown.prevent="pushTag(index)"
                    >
                        <span :style="{ color: tag.color }">{{ tag.name }}</span>
                        <span>{{ tag.postCount }}</span>
                    </div>
                </div>
            <el-tooltip :content="lang.GetText(`llgenerateprompt`)" placement="right">
                <el-button class="small-btn" style="margin-left: 5%; margin-top: -5px; width: 95%;" @click="() => {
                    store.generatePrompt();
                }" :disabled="true" :icon="MagicStick"/>
            </el-tooltip>
            <el-tooltip :content="lang.GetText(`llprompthistory`)" placement="right">
                <el-button class="small-btn" style="margin-left: 5%; margin-top: -5px; width: 95%;" @click="() => promptLibrary = true" :icon="Clock "/>
            </el-tooltip>
            <el-tooltip :content="lang.GetText(`llpromptstyles`)" placement="right">
                <el-button class="small-btn" style="margin-left: 5%; margin-top: 2px; width: 95%;" @click="() => selectStyle = true" :icon="TrendCharts"/>
            </el-tooltip>
            </div>
        </template>
    </form-input>
    <DialogList
        v-model="promptLibrary"
        :list="sortedPromptHistory"
        :title="lang.GetText(`llprompthistory`)"
        :empty-description="lang.GetText(`descnoprompthistory`)"
        :search-text="lang.GetText(`llsearchbyprompt`)"
        :search-empty-description="lang.GetText(`descnomatchingprompt`)"
        @use="prompt => store.prompt = prompt"
        @delete="store.removeFromPromptHistory"
    >
        <template #actions="{item, handleUse, handleDelete}">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap-reverse; align-items: center; width: 100%">
                <div style="color: var(--el-color-info); font-size: 12px">{{formatDate(getPromptFromHistory(item)?.timestamp || 0)}}</div> 
                <div>
                    <el-button class="small-btn" @click="() => handleUse(item)" :icon="Check">Apply</el-button>
                    <el-button
                        class="small-btn"
                        @click="() => handleFavourite(item)"
                        :icon="getPromptFromHistory(item)?.starred ? Star12Filled : Star12Regular"
                    ></el-button>
                    <el-button class="small-btn" type="danger" @click="() => handleDelete(item)" :icon="Delete">Delete</el-button>
                </div>
            </div>
        </template>
    </DialogList>
    <DialogList
        v-if="selectStyle"
        v-model="selectStyle"
        :list="Object.keys(store.styles).filter(el => el !== 'raw' && el.includes(searchStyle))"
        :title="lang.GetText(`llpromptstyles`)"
        :empty-description="lang.GetText(`descnostyles`)"
        :search-empty-description="lang.GetText(`descsearcchnostyles`)"
        :searchText="lang.GetText(`llsearchbystyle`)"
        :useText="lang.GetText(`llusestyle`)"
        @use="handleUseStyle"
        width="50%"
    >
        <template #options>
            <div>
                <span style="margin-right: 10px">{{lang.GetText(`showdetails`)}}</span>
                <el-switch v-model="showDetails" />
            </div>
        </template>
        <template #item="itemProps">
            <div style="display: flex; justify-content: space-between">
                <h3>{{itemProps.item}}</h3>
                <strong>{{store.styles[itemProps.item].model}}</strong>
            </div>
            <div v-if="showDetails">
                <h4>{{lang.GetText(`promptafterapply`)}}</h4>
                <div>
                    <span>{{getStyle(itemProps.item).promptSplit[0]}}</span>
                    <span style="color: var(--el-color-primary)">{{store.prompt || "(none)"}}</span>
                    <span>{{getStyle(itemProps.item).promptSplit[1]}}</span>
                </div>
                <div v-if="getStyle(itemProps.item).negativePromptSplit || getStyle(itemProps.item).prompt.includes('{np}')">
                    <h4>{{lang.GetText(`negativeprompt`)}}</h4>
                    <span>{{getStyle(itemProps.item)?.negativePromptSplit?.[0] || ""}}</span>
                    <span style="color: var(--el-color-primary)">{{store.negativePrompt || "(none)"}}</span>
                    <span>{{getStyle(itemProps.item)?.negativePromptSplit?.[1] || ""}}</span>
                </div>
            </div>
        </template>
    </DialogList>
    <form-input
        :label="lang.GetText(`llnegativeprompt`)"
        prop="negativePrompt"
        v-model="store.negativePrompt"
        autosize
        resize="vertical"
        type="textarea"
        :placeholder="lang.GetText(`placeholdernegative`)"
        :info="lang.GetText(`ttnegativeprompt`)"
        label-position="top"
        :spanWidth=3
    >
        <template #inline>
            <el-tooltip :content="lang.GetText(`lladdnegativeprompt`)" placement="right">
                <el-button class="small-btn" style="margin-left: 5%; margin-top: -5px; width: 95%;" @click="() => store.pushToNegativeLibrary(store.negativePrompt)" :icon="FolderChecked"/>
            </el-tooltip>
            <el-tooltip :content="lang.GetText(`llnegativeprompts`)" placement="right">
                <el-button class="small-btn" style="margin-left: 5%; margin-top: 2px; width: 95%;" @click="() =>  negativePromptLibrary = true" :icon="FolderOpened"/>
            </el-tooltip>
        </template>
    </form-input>
    <DialogList
        v-model="negativePromptLibrary"
        :title="lang.GetText(`llnegativeprompts`)"
        :list="store.negativePromptLibrary"
        :empty-description="lang.GetText(`descnonegativeprompts`)"
        :search-empty-description="lang.GetText(`descnomatchingnegativeprompts`)"
        :search-text="lang.GetText(`llsearchbyprompt`)"
        :deleteText="lang.GetText(`lldeletepreset`)"
        :useText="lang.GetText(`llusepreset`)"
        @use="negPrompt => store.negativePrompt = negPrompt"
        @delete="store.removeFromNegativeLibrary"
    />
</template>

<style scoped>
h3 {
    margin: 0;
}

#warning {
    background: #cfcf0f;
    color: black;
    font-weight: bold;
    padding-top: 10px;
    border-radius: 10px;
    margin: 20px;
}

#warning svg {
    float: left;
    width: 15%;
    height: 100%;
    padding-right: 3%;
    padding-left: 2%;
    max-height: 125px;
}

#warning .wtext {
    float: left;
    width: 80%;
}

#warning strong {
    margin-bottom: 5px;
    display: block;
    font-size: 20px;
}

#warning .clear:after {
  content: "";
  display: table;
  clear: both;
}

h4, h5 {
    margin-bottom: 0;
}

.trigger-select {
    width: 30px;
    height: 30px;
}

:deep(.trigger-select .el-input__wrapper) {
    padding: 0;
}

.trigger-select .el-select__caret {
    margin: 0;
}

:deep(.trigger-select .el-input__suffix, .trigger-select .el-input__suffix-inner) {
    width: 100%
}
.tag-select {
    display: flex;
    justify-content: space-between;
    gap: 32px;
    padding: 0px 8px;
    width: 240px;
}

.tag-select:hover {
    background-color: rgb(100, 100, 100) !important;
}

</style>