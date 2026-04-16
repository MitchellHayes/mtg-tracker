import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './Home'
import Dashboard from './Dashboard'
import PlayerController from './PlayerController'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/player/:id" element={<PlayerController />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App