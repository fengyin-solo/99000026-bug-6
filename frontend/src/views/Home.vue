<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="18">
        <h2 class="page-title">
          {{ pageTitle }}
          <el-tag
            v-if="selectedTag"
            type="info"
            class="filter-tag"
            closable
            @close="clearTag"
          >
            标签: {{ selectedTag }}
          </el-tag>
          <el-tag v-if="searchQuery" type="info" class="filter-tag" closable @close="clearSearch">
            搜索: {{ searchQuery }}
          </el-tag>
        </h2>

        <div v-loading="loading">
          <ArticleCard
            v-for="article in articles"
            :key="article.id"
            :article="article"
            :highlight-query="searchQuery"
            :back-path="route.fullPath"
            @tag-click="handleTagSelect"
          />

          <el-empty v-if="!loading && articles.length === 0" :description="emptyDescription">
            <el-button v-if="loadError" type="primary" @click="fetchArticles">
              重新加载
            </el-button>
            <el-button v-else-if="hasFilters" type="primary" @click="resetFilters">
              清除全部条件
            </el-button>
          </el-empty>
        </div>

        <Pagination
          :model-value="currentPage"
          :total="pagination.total"
          :page-size="pagination.limit"
          @change="handlePageChange"
        />
      </el-col>

      <el-col :span="6">
        <TagFilter
          :tags="availableTags"
          :selected-tag="selectedTag"
          :loading="tagsLoading"
          :error="tagsError"
          @select="handleTagSelect"
          @retry="fetchTags"
        />
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import ArticleCard from '../components/ArticleCard.vue'
import TagFilter from '../components/TagFilter.vue'
import Pagination from '../components/Pagination.vue'

const route = useRoute()
const router = useRouter()

const articles = ref([])
const tags = ref([])
const loading = ref(false)
const tagsLoading = ref(false)
const loadError = ref(false)
const tagsError = ref(false)
const pagination = ref({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0
})

// URL 是筛选/分页状态的唯一数据源，避免本地状态与地址在
// 前进后退、清空条件、详情返回等入口下出现两份状态。
const selectedTag = computed(() => route.query.tag || null)
const searchQuery = computed(() => route.query.search || '')
const currentPage = computed(() => {
  const page = parseInt(route.query.page, 10)
  return Number.isInteger(page) && page > 0 ? page : 1
})
const hasFilters = computed(() => Boolean(selectedTag.value || searchQuery.value))

// 标签集合暂时为空或请求失败时，当前选中的标签仍要能在侧边栏
// 显示并可点击，保留可恢复入口。
const availableTags = computed(() => {
  if (selectedTag.value && !tags.value.includes(selectedTag.value)) {
    return [selectedTag.value, ...tags.value]
  }
  return tags.value
})

const pageTitle = computed(() => {
  if (searchQuery.value) {
    return '搜索结果'
  }
  return selectedTag.value ? `标签: ${selectedTag.value}` : '最新文章'
})

const emptyDescription = computed(() => {
  if (loadError.value) {
    return '加载失败，请重试'
  }
  if (searchQuery.value) {
    return '未找到匹配的文章'
  }
  if (selectedTag.value) {
    return `标签 "${selectedTag.value}" 下暂无文章`
  }
  return '暂无文章'
})

onMounted(() => {
  fetchArticles()
  fetchTags()
})

// 只在 query 变化时拉取（前进/后退、清空条件、详情返回都经由路由，
// 状态天然同步）。首次挂载由 onMounted 负责，避免重复请求。
watch(() => route.query, () => {
  fetchArticles()
})

let fetchToken = 0

async function fetchArticles() {
  const token = ++fetchToken
  loading.value = true
  loadError.value = false
  try {
    const params = {
      page: currentPage.value,
      limit: pagination.value.limit
    }
    if (selectedTag.value) {
      params.tag = selectedTag.value
    }
    if (searchQuery.value) {
      params.search = searchQuery.value
    }

    const response = await api.get('/articles', { params })
    // 快速切换标签/前进后退时，丢弃已过期的慢响应，防止旧标签结果覆盖。
    if (token !== fetchToken) return
    articles.value = response.data.articles
    pagination.value = response.data.pagination
  } catch (error) {
    console.error('Failed to fetch articles:', error)
    if (token !== fetchToken) return
    loadError.value = true
    articles.value = []
  } finally {
    if (token === fetchToken) {
      loading.value = false
    }
  }
}

async function fetchTags() {
  tagsLoading.value = true
  tagsError.value = false
  try {
    const response = await api.get('/tags')
    tags.value = response.data.tags
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    tagsError.value = true
  } finally {
    tagsLoading.value = false
  }
}

function updateQuery(changes) {
  // 去掉与空值/默认值等价的参数，保持地址简洁并与状态一致
  const query = {}
  const merged = {
    tag: Object.prototype.hasOwnProperty.call(changes, 'tag') ? changes.tag : selectedTag.value,
    search: Object.prototype.hasOwnProperty.call(changes, 'search') ? changes.search : searchQuery.value,
    page: Object.prototype.hasOwnProperty.call(changes, 'page') ? changes.page : currentPage.value
  }
  if (merged.tag) query.tag = merged.tag
  if (merged.search) query.search = merged.search
  if (merged.page && merged.page !== 1) query.page = String(merged.page)
  router.push({ path: '/', query })
}

function handlePageChange(page) {
  updateQuery({ page })
}

function handleTagSelect(tag) {
  updateQuery({ tag, page: 1 })
}

function clearTag() {
  updateQuery({ tag: null, page: 1 })
}

function clearSearch() {
  updateQuery({ search: null, page: 1 })
}

function resetFilters() {
  loadError.value = false
  router.push({ path: '/' })
}
</script>

<style scoped>
.home {
  padding-top: 20px;
}

.page-title {
  font-size: 24px;
  color: #303133;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-tag {
  font-size: 14px;
  font-weight: normal;
}
</style>
