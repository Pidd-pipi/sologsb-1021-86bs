<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DictionaryEntry } from '~/types/dictionary';
import { parseSenses, removeSensesFromDefinition } from '~/utils/dictionary';
import { useDictionaryStore } from '~/store/dictionary';

const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ entry: DictionaryEntry | null }>();
const store = useDictionaryStore();

const posOptions = ['名词', '动词', '形容词', '副词', '方向词', '量词', '短语'];

const draftDefinition = ref('');
const checkedSenses = ref<string[]>([]);
const checkedExampleIds = ref<string[]>([]);
const newPartOfSpeech = ref('');

const senses = computed(() => parseSenses(draftDefinition.value));
const remainingDefinition = computed(() => removeSensesFromDefinition(draftDefinition.value, checkedSenses.value));
const canSplit = computed(() => checkedSenses.value.length > 0
  && senses.value.length - checkedSenses.value.length >= 1);

watch(visible, (open) => {
  if (!open || !props.entry) return;
  draftDefinition.value = props.entry.definition;
  checkedSenses.value = senses.value.length > 1 ? senses.value.slice(-1) : [];
  checkedExampleIds.value = [];
  newPartOfSpeech.value = props.entry.partOfSpeech;
});

const toggleSense = (sense: string, checked: boolean) => {
  if (checked) {
    if (!checkedSenses.value.includes(sense)) checkedSenses.value = [...checkedSenses.value, sense];
  } else {
    checkedSenses.value = checkedSenses.value.filter((item) => item !== sense);
  }
};

const toggleExample = (id: string, checked: boolean) => {
  if (checked) {
    if (!checkedExampleIds.value.includes(id)) checkedExampleIds.value = [...checkedExampleIds.value, id];
  } else {
    checkedExampleIds.value = checkedExampleIds.value.filter((item) => item !== id);
  }
};

const confirmSplit = () => {
  if (!props.entry || !canSplit.value) return;
  store.splitEntry({
    entryId: props.entry.id,
    definition: draftDefinition.value,
    movedSenses: checkedSenses.value,
    movedExampleIds: checkedExampleIds.value,
    partOfSpeech: newPartOfSpeech.value
  });
  visible.value = false;
};
</script>

<template>
  <t-dialog v-model:visible="visible" header="按义项拆分词条" width="780px" :footer="false">
    <div v-if="entry" class="split-dialog">
      <div class="split-meta">
        <span><strong>词形</strong>{{ entry.headword || '未命名词条' }}</span>
        <span><strong>发音</strong>{{ entry.pronunciation || '待补' }}</span>
        <span><strong>当前词性</strong>{{ entry.partOfSpeech || '词性待定' }}</span>
      </div>
      <t-alert theme="primary" message="勾选要移出的义项与例句生成新条目；方言变体、来源与未勾选的例句留在原条。新条目继承词形、发音、词性与审校意见，并记录双向来源关系。" class="split-tip" />

      <label class="field-block"><span>释义（义项之间用分号“；”分隔）</span>
        <t-textarea v-model="draftDefinition" :autosize="{ minRows: 3, maxRows: 7 }" />
      </label>

      <div v-if="senses.length >= 2" class="split-senses">
        <div class="split-section-title"><strong>选择要移出的义项</strong><span>原条至少保留 1 个</span></div>
        <label v-for="sense in senses" :key="sense" class="sense-option" :class="{ checked: checkedSenses.includes(sense) }">
          <input type="checkbox" :checked="checkedSenses.includes(sense)" @change="toggleSense(sense, ($event.target as HTMLInputElement).checked)" />
          <span>{{ sense }}</span>
        </label>
      </div>
      <t-alert v-else theme="warning" message="当前释义无法拆出义项：请先在上方用分号“；”分隔不同义项（至少两个）。" class="split-tip" />

      <div v-if="entry.examples.length" class="split-examples">
        <div class="split-section-title"><strong>选择随义项移出的例句</strong><span>不勾选的留在原条</span></div>
        <label v-for="example in entry.examples" :key="example.id" class="example-option" :class="{ checked: checkedExampleIds.includes(example.id) }">
          <input type="checkbox" :checked="checkedExampleIds.includes(example.id)" @change="toggleExample(example.id, ($event.target as HTMLInputElement).checked)" />
          <span><strong>{{ example.text }}</strong><small>{{ example.translation }} · {{ example.source || '出处待补' }}</small></span>
        </label>
      </div>

      <div class="split-pos-row">
        <label class="field-block"><span>新条目词性（默认继承原条）</span>
          <t-select v-model="newPartOfSpeech" clearable filterable>
            <t-option v-for="pos in posOptions" :key="pos" :value="pos" :label="pos" />
          </t-select>
        </label>
      </div>

      <div class="split-preview">
        <div><strong>原条保留释义</strong><p>{{ remainingDefinition || '（无，必须保留至少一个义项）' }}</p></div>
        <div><strong>新条目释义</strong><p>{{ checkedSenses.join('；') || '（尚未勾选义项）' }}</p></div>
      </div>

      <div class="dialog-actions">
        <t-button variant="outline" @click="visible = false">取消</t-button>
        <t-button theme="primary" :disabled="!canSplit" @click="confirmSplit">拆分为新条目</t-button>
      </div>
    </div>
  </t-dialog>
</template>
