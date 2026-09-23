<template>
  <el-card class="article-card" shadow="hover" @click="goToArticle">
    <template #header>
      <div class="card-header">
        <h3 class="article-title" v-html="highlightText(article.title)"></h3>
        <span class="article-date">{{ formatDate(article.created_at) }}</span>
      </div>
    </template>
    <p class="article-summary" v-html="highlightText(article.summary)"></p>
    <div class="article-tags">
      <el-tag
        v-for="tag in article.tags"
        :key="tag"
        size="small"
        @click.stop="filterByTag(tag)"
      >
        {{ tag }}
      </el-tag>
    </div>
  </el-card>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  article: {
    type: Object,
    required: true
  },
  highlightQuery: {
    type: String,
    default: ''
  },
  backPath: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['tag-click'])
const router = useRouter()

function goToArticle() {
  router.push({
    path: `/article/${props.article.id}`,
    query: props.backPath ? { back: props.backPath } : {}
  })
}

function filterByTag(tag) {
  emit('tag-click', tag)
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function highlightText(text) {
  if (!props.highlightQuery || !text) {
    return text
  }
  const regex = new RegExp(`(${props.highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="highlight">$1</mark>')
}
</script>

<style scoped>
.article-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.article-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.article-title {
  font-size: 18px;
  color: #303133;
  margin: 0;
  flex: 1;
}

.article-date {
  color: #909399;
  font-size: 14px;
  white-space: nowrap;
  margin-left: 16px;
}

.article-summary {
  color: #606266;
  line-height: 1.6;
  margin-bottom: 12px;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.article-tags .el-tag {
  cursor: pointer;
}

:deep(.highlight) {
  background-color: #fff3cd;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
