import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { ItemList } from './pages/ItemList'
import { NewItem } from './pages/NewItem'
import { ItemDetail } from './pages/ItemDetail'
import { Archive } from './pages/Archive'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/items" element={<ItemList />} />
      <Route path="/items/new" element={<NewItem />} />
      <Route path="/items/:id" element={<ItemDetail />} />
      <Route path="/archive" element={<Archive />} />
    </Routes>
  )
}

export default App
