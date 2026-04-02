import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Controller from './Controller'
import Dashboard from './Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/controller" element={<Controller />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App