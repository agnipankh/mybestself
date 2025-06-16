import AuthGuard from '@/components/AuthGuard'
import SetupIdentityPage from '@/components/SetupIdentityPage'

export default function HomePage() {
  return (
    <AuthGuard requireAuth={false}>
      <SetupIdentityPage />
    </AuthGuard>
  )
}

// In app/mbs/page.tsx - temporarily add this
//import ApiTest from '@/components/ApiTest'
//
//export default function MbsPage() {
//  return (
//    <div>
//      {/* Your existing SetupIdentityPage */}
//      
//      {/* Temporary test section */}
//      <div className="mt-8 border-t pt-8">
//        <ApiTest />
//      </div>
//    </div>
//  )
//}



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
