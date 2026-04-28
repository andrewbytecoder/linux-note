
## vue 响应式


### ref & reactive
reactive只适用于对象，包括数组和内置类型，如Map和Set。另外一个API ref则可以接受任何值类型，ref会返回一个包裹对象并在 `.value` 属性下暴漏内部值。




### v-bind

mustache  - 插值时可以进行动态绑定，v-bind可以简写为 `:`

```js
<script setup>
import { ref } from 'vue'

const titleClass = ref('title')
</script>

<template>
  // 将class 动态绑定为 titleClass， titleClass 会解析为 title，title为css style
  <h1 :class="titleClass">Make me red</h1>
</template>

<style>
.title {
  color: red;
}
</style>
```

### 事件监听
使用 `v-on` 指令进行DOM事件监听，同时 `v-on` 事件监听可以简写为 `@`
```js
<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">Count is: {{ count }}</button>
</template>
```



### 表单绑定
可以同时使用 `v-bind` 和 `v-on` 来在表单的输入元素上创建双向绑定
```js
<script setup>
import { ref } from 'vue'

const text = ref('')

function onInput(e) {
  text.value = e.target.value
}
</script>

<template>
  // v-bind 用来实时显示  value ， v-on 用来实时同步输入数据，两者同时作用相当于使用 v-mode <input v-model="text">
  <input :value="text" @input="onInput" placeholder="Type here">
  <p>{{ text }}</p>
</template>
```

以下效果和上述表单绑定效果相同
```js
<script setup>
import { ref } from 'vue'

const text = ref('')
</script>

<template>
  <input v-model="text" placeholder="Type here">
  <p>{{ text }}</p>
</template>
```
`v-model` 会将被绑定的值与 `<input>` 的值自动同步，这样我们就不必再使用事件处理函数了。
`v-model` 不仅支持文本输入框，也支持诸如多选框、单选框、下拉框之类的输入类型。


### 条件渲染

当条件为真值的时候才进行渲染
```js
<h1 v-if="awesome">Vue is awesome!</h1>
```

```js
<script setup>
import { ref } from 'vue'

const awesome = ref(false)

function toggle() {
  // ...
  awesome.value = !awesome.value
}
</script>

<template>
  <button @click="toggle">Toggle</button>
  <h1 v-if='awesome'>Vue is awesome!</h1>
  <h1 v-else>Oh no 😢</h1>
</template>
```

### 列表渲染

```vue
<script setup>
import { ref } from 'vue'

// 给每个 todo 对象一个唯一的 id
let id = 0

const newTodo = ref('')
const todos = ref([
  { id: id++, text: 'Learn HTML' },
  { id: id++, text: 'Learn JavaScript' },
  { id: id++, text: 'Learn Vue' }
])

function addTodo() {
  todos.value.push({ id: id++, text: newTodo.value })
  newTodo.value = ''
}

function removeTodo(todo) {
  todos.value = todos.value.filter((t) => t !== todo)
}
</script>

<template>
  <form @submit.prevent="addTodo">
    <input v-model="newTodo" required placeholder="new todo">
    <button>Add Todo</button>
  </form>
  <ul>
    <li v-for="todo in todos" :key="todo.id">
      {{ todo.text }}
      // 执行 removeTodo 函数，并把 todo作为参数
      <button @click="removeTodo(todo)">X</button>
    </li>
  </ul>
</template>
```


### 计算属性
```vue
<script setup>
import { ref, computed } from 'vue'

let id = 0

const newTodo = ref('')
const hideCompleted = ref(false)
const todos = ref([
  { id: id++, text: 'Learn HTML', done: true },
  { id: id++, text: 'Learn JavaScript', done: true },
  { id: id++, text: 'Learn Vue', done: false }
])

// 计算属性，监控的属性值变动会自动再次进行计算值
const filteredTodos = computed(() => {
  return hideCompleted.value
    ? todos.value.filter((t) => !t.done)
    : todos.value
})

function addTodo() {
  todos.value.push({ id: id++, text: newTodo.value, done: false })
  newTodo.value = ''
}

function removeTodo(todo) {
  todos.value = todos.value.filter((t) => t !== todo)
}
</script>

<template>
  <form @submit.prevent="addTodo">
    <input v-model="newTodo" required placeholder="new todo">
    <button>Add Todo</button>
  </form>
  <ul>
    <li v-for="todo in filteredTodos" :key="todo.id">
      <input type="checkbox" v-model="todo.done">
      // { done: todo.done }  done 为true就有属性，false就没有done属性
      <span :class="{ done: todo.done }">{{ todo.text }}</span>
      <button @click="removeTodo(todo)">X</button>
    </li>
  </ul>
  <button @click="hideCompleted = !hideCompleted">
    {{ hideCompleted ? 'Show all' : 'Hide completed' }}
  </button>
</template>

<style>
.done {
  text-decoration: line-through;
  color: green;
}
</style>
```

### 生命周期和模板引用
![[Pasted image 20260427141622.png]]
Vue 为我们处理了所有的 DOM 更新，这要归功于响应性和声明式渲染。然而，有时我们也会不可避免地需要手动操作 DOM。

这时我们需要使用**模板引用**——也就是指向模板中一个 DOM 元素的 ref。我们需要通过[这个特殊的 `ref` attribute](https://cn.vuejs.org/api/built-in-special-attributes.html#ref) 来实现模板引用：
```ts
<p ref="pElementRef">hello</p>
```
要访问该引用，我们需要声明一个同名的 ref：
```ts
const pElementRef = ref(null)
```
注意这个 ref 使用 `null` 值来初始化。这是因为当 `<script setup>` 执行时，DOM 元素还不存在。模板引用 ref 只能在组件**挂载**后访问。
要在挂载之后执行代码，我们可以使用 `onMounted()` 函数：

```vue
<script setup>
import { ref, onMounted } from 'vue'

const pElementRef = ref(null)

onMounted(() => {
	// 这里就能修改 元素的内容
  pElementRef.value.textContent = 'mounted!'
})
</script>

<template>
  <p ref="pElementRef">Hello</p>
</template>
```

### 侦听器
有时候我们需要响应的执行一些-副作用，例如将数字改变输出到控制台
```vue
<script setup>
import { ref, watch } from 'vue'

const todoId = ref(1)
const todoData = ref(null)

async function fetchData() {
  todoData.value = null
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/todos/${todoId.value}`
  )
  todoData.value = await res.json()
}

fetchData()
// 监听todoId 如果todoId变化，就调用fetchData
watch(todoId, fetchData)
</script>

<template>
  <p>Todo id: {{ todoId }}</p>
  <!-- 如果todoData为空则按钮失能 -->
  <button @click="todoId++" :disabled="!todoData">Fetch next todo</button>
  <p v-if="!todoData">Loading...</p>
  <pre v-else>{{ todoData }}</pre>
</template>
```

### 组件
父组件可以通过 `import` 引入子组件

### Props
子组件能通过Props从父组件接受动态数据
App.vue
```vue
<script setup>
import { ref } from 'vue'
import ChildComp from './ChildComp.vue'

const greeting = ref('Hello from parent')
</script>

<template>
  <ChildComp :msg="greeting" />
</template>
```

ChildComp.vue
```vue
<script setup>
const props = defineProps({
  msg: String
})
</script>

<template>
  <h2>{{ msg || 'No props passed yet' }}</h2>
</template>
```

### Emits
子组件除了能从父组件接受props，子组件还能向父组件触发事件：
`emit()` 的第一个参数是事件的名称。其他所有参数都将传递给事件监听器。
父组件可以使用 `v-on` 监听子组件触发的事件——这里的处理函数接收了子组件触发事件时的额外参数并将它赋值给了本地状态：

App.vue
```vue
<script setup>
import { ref } from 'vue'
import ChildComp from './ChildComp.vue'

const childMsg = ref('No child msg yet')
</script>

<template>
  <ChildComp @response="(msg) => childMsg = msg" />
  <p>{{ childMsg }}</p>
</template>
```

ChildComp.vue
```vue
<script setup>
const emit = defineEmits(['response'])

emit('response', 'hello from child')
</script>

<template>
  <h2>Child component</h2>
</template>
```

### 插槽
除了通过props传递数据外，父组件还可以通过插槽slots将模版片段传递给子组件

在子组件中，可以使用 `<slot>` 元素作为插槽出口 (slot outlet) 渲染父组件中的插槽内容 (slot content)
App.vue
```vue
<script setup>
import { ref } from 'vue'
import ChildComp from './ChildComp.vue'

const msg = ref('from parent')
</script>

<template>
  <ChildComp>Message: {{ msg }}</ChildComp>
</template>
```

ChildComp.vue
```vue
<template>
  <slot>Fallback content</slot>
</template>
```