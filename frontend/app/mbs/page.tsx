import AuthGuard from '@/components/AuthGuard'
import SetupIdentityPage from '@/components/SetupIdentityPage'

export default function HomePage() {
  return (
    <AuthGuard requireAuth={false}>
      <SetupIdentityPage />
    </AuthGuard>
  )
}

// OR if you want to require authentication:
// export default function HomePage() {
//   return (
//     <AuthGuard requireAuth={true}>
//       <SetupIdentityPage />
//     </AuthGuard>
//   )
// }

// OR create separate routes:
// app/page.tsx - Public landing page
// app/app/page.tsx - Protected app that requires auth
