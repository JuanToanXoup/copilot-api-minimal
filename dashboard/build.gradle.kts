plugins {
    base
}

group = "com.citi"
version = "1.0.0"

val frontendDir = file("frontend")
val backendDir = file("backend")

// Detect OS for proper command execution
val isWindows = System.getProperty("os.name").lowercase().contains("windows")
fun cmd(vararg args: String): List<String> = if (isWindows) listOf("cmd", "/c") + args else args.toList()

// ============ Frontend Tasks (React/Vite) ============

tasks.register<Exec>("installFrontend") {
    group = "dashboard"
    description = "Install frontend npm dependencies"
    workingDir = frontendDir
    commandLine(cmd("npm", "install"))
    inputs.file("$frontendDir/package.json")
    outputs.dir("$frontendDir/node_modules")
}

tasks.register<Exec>("buildFrontend") {
    group = "dashboard"
    description = "Build frontend for production"
    dependsOn("installFrontend")
    workingDir = frontendDir
    commandLine(cmd("npm", "run", "build"))
    inputs.dir("$frontendDir/src")
    inputs.file("$frontendDir/package.json")
    outputs.dir("$frontendDir/dist")
}

tasks.register<Exec>("startFrontend") {
    group = "dashboard"
    description = "Start frontend dev server"
    dependsOn("installFrontend")
    workingDir = frontendDir
    commandLine(cmd("npm", "run", "dev"))
}

tasks.register<Exec>("lintFrontend") {
    group = "dashboard"
    description = "Lint frontend code"
    dependsOn("installFrontend")
    workingDir = frontendDir
    commandLine(cmd("npm", "run", "lint"))
}

// ============ Backend Tasks (Python/FastAPI) ============

tasks.register<Exec>("startBackend") {
    group = "dashboard"
    description = "Start backend server"
    workingDir = backendDir
    commandLine(cmd("python3", "server.py"))
}

tasks.register<Exec>("checkBackend") {
    group = "dashboard"
    description = "Check backend Python syntax"
    workingDir = backendDir
    commandLine(cmd("python3", "-m", "py_compile", "server.py"))
}

// ============ Combined Tasks ============

tasks.named("build") {
    dependsOn("buildFrontend")
}

tasks.register("start") {
    group = "dashboard"
    description = "Start dashboard (shows instructions)"
    doLast {
        println("""
            |
            |=== Dashboard Startup ===
            |
            |The dashboard consists of two services that need to run in separate terminals:
            |
            |1. Backend (Python/FastAPI):
            |   cd dashboard/backend && python3 server.py
            |   Or: ./gradlew :dashboard:startBackend
            |
            |2. Frontend (React/Vite):
            |   cd dashboard/frontend && npm run dev
            |   Or: ./gradlew :dashboard:startFrontend
            |
            |Then open: http://localhost:5173
            |
        """.trimMargin())
    }
}

tasks.register("info") {
    group = "help"
    description = "Show dashboard module information"

    doLast {
        println("""
            |
            |=== Dashboard Module ===
            |
            |Frontend: React + Vite + TypeScript
            |  Location: dashboard/frontend/
            |  Port: 5173 (dev server)
            |
            |Backend: Python + FastAPI
            |  Location: dashboard/backend/
            |  Port: 8080
            |
            |Available tasks:
            |  ./gradlew :dashboard:installFrontend  - Install npm dependencies
            |  ./gradlew :dashboard:buildFrontend    - Build frontend for production
            |  ./gradlew :dashboard:startFrontend    - Start frontend dev server
            |  ./gradlew :dashboard:startBackend     - Start backend server
            |  ./gradlew :dashboard:start            - Show startup instructions
            |
        """.trimMargin())
    }
}
