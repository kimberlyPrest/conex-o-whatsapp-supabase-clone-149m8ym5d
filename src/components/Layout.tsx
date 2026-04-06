import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  LogOut,
  MessageCircle,
  LayoutDashboard,
  Bot,
  Settings,
  Key,
  Menu,
  MessageSquareText,
  LayoutGrid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import logoImg from '@/assets/image-e5f50.png'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
    }
  }, [user, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  if (!user) return null

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/conversations', label: 'Conversas', icon: MessageSquareText },
    { path: '/crm', label: 'CRM Kanban', icon: LayoutGrid },
    { path: '/', label: 'Conexão WhatsApp', icon: MessageCircle },
    { path: '/agents', label: 'Meus Agentes', icon: Bot },
    { path: '/ai-config', label: 'Chaves API', icon: Key },
  ]

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-72 fixed h-full z-20 px-4 py-6">
        <div className="mb-10 px-4 flex items-center gap-2">
          <img
            src={logoImg}
            alt="AutoWhats"
            className="h-10 w-10 object-contain rounded-full"
          />
          <span className="font-display font-bold text-xl tracking-tight text-foreground">
            AutoWhats
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={
                  location.pathname === item.path ? 'secondary' : 'ghost'
                }
                className={cn(
                  'w-full justify-start gap-3 h-12 px-6 rounded-full transition-all duration-300 font-medium',
                  location.pathname === item.path
                    ? 'bg-white shadow-sm text-primary ring-1 ring-black/5'
                    : 'text-muted-foreground hover:bg-white/50 hover:text-foreground',
                )}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5',
                    location.pathname === item.path ? 'text-primary' : '',
                  )}
                />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 px-2">
          <div className="flex items-center gap-3 p-3 rounded-full bg-white/50 border border-white/20 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate text-foreground">
                {user.email?.split('@')[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header & Main Content */}
      <div className="flex-1 md:ml-72 flex flex-col min-h-screen transition-all duration-300 w-full overflow-x-hidden">
        <header className="md:hidden sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4 max-w-full">
            <div className="flex items-center gap-2">
              <img
                src={logoImg}
                alt="AutoWhats"
                className="h-8 w-8 object-contain rounded-full shrink-0"
              />
              <span className="font-bold text-lg truncate">AutoWhats</span>
            </div>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full shrink-0"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[300px] sm:w-[350px] p-0 flex flex-col"
              >
                <SheetHeader className="p-6 text-left border-b border-border/50">
                  <SheetTitle className="flex items-center gap-2">
                    <img
                      src={logoImg}
                      alt="AutoWhats"
                      className="h-8 w-8 object-contain rounded-full"
                    />
                    <span className="font-bold text-xl">AutoWhats</span>
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Navegação do aplicativo mobile
                  </SheetDescription>
                </SheetHeader>

                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant={
                          location.pathname === item.path
                            ? 'secondary'
                            : 'ghost'
                        }
                        className={cn(
                          'w-full justify-start gap-3 h-12 px-4 rounded-xl transition-all duration-300 font-medium',
                          location.pathname === item.path
                            ? 'bg-primary/10 text-primary hover:bg-primary/15'
                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                        )}
                      >
                        <item.icon
                          className={cn(
                            'w-5 h-5',
                            location.pathname === item.path
                              ? 'text-primary'
                              : '',
                          )}
                        />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto p-4 border-t border-border/50 bg-gray-50/50">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-sm border border-border/50">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white font-bold">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm font-bold truncate text-foreground">
                        {user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        handleSignOut()
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
