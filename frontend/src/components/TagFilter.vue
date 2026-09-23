<template>
  <div class="tag-filter">
    <h4 class="filter-title">标签筛选</h4>
    <div v-if="loading" class="filter-status">标签加载中…</div>
    <div v-else-if="error" class="filter-status">
      <span>标签加载失败</span>
      <el-button link type="primary" size="small" @click="$emit('retry')">重试</el-button>
    </div>
    <div class="tag-list">
      <el-tag
        :type="selectedTag === null ? '' : 'info'"
        class="tag-item"
        @click="selectTag(null)"
        effect="dark"
      >
        全部
      </el-tag>
      <el-tag
        v-for="tag in tags"
        :key="tag"
        :type="selectedTag === tag ? '' : 'info'"
        :effect="selectedTag === tag ? 'dark' : 'plain'"
        class="tag-item"
        @click="selectTag(tag)"
      >
        {{ tag }}
      </el-tag>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tags: {
    type: Array,
    default: () => []
  },
  selectedTag: {
    type: String,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select', 'retry'])

function selectTag(tag) {
  emit('select', tag)
}
</script>

<style scoped>
.tag-filter {
  margin-bottom: 20px;
}

.filter-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}

.filter-status {
  font-size: 13px;
  color: #909399;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  cursor: pointer;
}
</style>
