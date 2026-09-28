<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DictionaryEntry } from '~/types/dictionary';
import { useDictionaryStore } from '~/store/dictionary';

const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ entry: DictionaryEntry }>();
const store = useDictionaryStore();

const selectedSenses = ref<number[]>([]);
const selectedExamples = ref<string[]>([]);
const newPartOfSpeech = ref('');

const splitDefinition = (value: string) => value
  .split(/[;；]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const senses = computed(() => splitDefinition(props.entry.definition));
const movedDefinition = computed(() => selectedSenses.value.map((index) => senses.value[index]).filter(Boolean).join('；'));
const remainingDefinition = computed(() => senses.value
  .map((sense, index) => ({ sense, index }))
  .filter(({ index }) => !selectedSenses.value.includes(index))
  .map(({ sense }) => sense)
  .join('；'));
const movedExamples = computed(() => props.entry.examples.filter((example) => selectedExamples.value.includes(example.id)));
const canSubmit = computed(() => Boolean(movedDefinition.value && remainingDefinition.value));

watch(visible, (open) => {
  if (!open) return;
  selectedSenses.value = senses.value.length > 1 ? [senses.value.length - 1] : [];
  selectedExamples.value = [];
  newPartOfSpeech.value = props.entry.partOfSpeech;
});

const toggleSense = (index: number) => {
  selectedSenses.value = selectedSenses.value.includes(index)
    ? selectedSenses.value.filter((item) => item !== index)
    : [...selectedSenses.value, index].sort((a, b) => a - b);
};

const submit = () => {
  if (!canSubmit.value) return;
  store.splitEntry(props.entry.id, {
    definition: movedDefinition.value,
    exampleIds: selectedExamples.value,
    partOfSpeech: newPartOfSpeech.value
  });
  visible.value = false;
};
</script>

<template>
  <t-dialog v-model:visible="visible" header="按义项拆分词条" width="860px" :footer="false" class="split-dialog">
    <div class="split-content">
      <div class="split-intro">
        <strong>{{ entry.headword || '未命名词条' }}</strong>
        <span>勾选要移出的释义和对应例句；新词形、发音、词性和审校意见会继承到新条目。</span>
      </div>

      <section class="split-section">
        <header><h3>1. 选择移出义项</h3><small>按分号识别同一词条下的多个义项</small></header>
        <label v-for="(sense, index) in senses" :key="`${sense}-${index}`" class="split-option sense-option">
          <input type="checkbox" :checked="selectedSenses.includes(index)" @change="toggleSense(index)" />
          <span class="option-index">{{ index + 1 }}</span>
          <p>{{ sense }}</p>
        </label>
        <t-empty v-if="senses.length < 2" description="请先用分号分隔多个义项后再拆分" />
      </section>

      <section class="split-section">
        <header><h3>2. 选择对应例句</h3><small>勾选的例句移动到新条目，其余例句保留在原条</small></header>
        <label v-for="example in entry.examples" :key="example.id" class="split-option example-option">
          <input v-model="selectedExamples" type="checkbox" :value="example.id" />
          <div>
            <p>{{ example.text || '未填写例句原文' }}</p>
            <small>{{ example.translation || '暂无译文' }} · {{ example.source || '出处待补' }}</small>
          </div>
        </label>
        <t-empty v-if="!entry.examples.length" description="当前词条没有可移动的例句" />
      </section>

      <div class="split-grid">
        <label class="field-block">
          <span>新条目词性</span>
          <t-select v-model="newPartOfSpeech" clearable>
            <t-option value="名词" label="名词" />
            <t-option value="动词" label="动词" />
            <t-option value="形容词" label="形容词" />
            <t-option value="副词" label="副词" />
            <t-option value="方向词" label="方向词" />
            <t-option value="量词" label="量词" />
            <t-option value="短语" label="短语" />
          </t-select>
        </label>
        <div class="split-inherit"><strong>继承内容</strong><span>词形、发音、{{ entry.reviewerComments.length }} 条审校意见</span></div>
      </div>

      <div class="split-preview">
        <article>
          <strong>原条保留释义</strong>
          <p :class="{ placeholder: !remainingDefinition }">{{ remainingDefinition || '至少保留一个义项' }}</p>
          <small>方言变体、结构化来源和未勾选例句继续留在原条。</small>
        </article>
        <article>
          <strong>新条目移出释义</strong>
          <p :class="{ placeholder: !movedDefinition }">{{ movedDefinition || '请勾选至少一个义项' }}</p>
          <small>将移动 {{ movedExamples.length }} 条例句，并记录拆分来源关系。</small>
        </article>
      </div>

      <div class="dialog-actions">
        <t-button variant="outline" @click="visible = false">取消</t-button>
        <t-button theme="primary" :disabled="!canSubmit" @click="submit">生成义项新条目</t-button>
      </div>
    </div>
  </t-dialog>
</template>
