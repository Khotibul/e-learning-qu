import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role?: string | undefined
    }
  }

  interface User {
    role?: string | undefined
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string | undefined
  }
}
