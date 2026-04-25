import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { ItemList } from './pages/ItemList'
import { NewItem } from './pages/NewItem'
import { ItemDetail } from './pages/ItemDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/items" element={<ItemList />} />
      <Route path="/items/new" element={<NewItem />} />
      <Route path="/items/:id" element={<ItemDetail />} />
    </Routes>
  )
}

export default App
