import AppSidebar from './AppSidebar'

export default function SidebarLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-dark-bg">
      <AppSidebar />
      <main className="flex-1 min-h-screen" style={{ marginLeft: '240px' }}>
        {children}
      </main>
    </div>
  )
}
