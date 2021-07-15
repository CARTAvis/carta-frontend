pipeline {
    agent none
    stages {
        stage('Format check') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "npm install"
                    sh "npm run checkformat"
                }
            }
        }
        stage('WebAssembly compilation') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "npm run build-libs-docker"
                    stash includes: "carta-frontend", name: "carta_frontend_with_built_libs"
                }
            }
        }
        stage('node v12') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    unstash "carta_frontend_with_built_libs"
                    sh "rm -rf node_modules"
                    sh "nvm use 12"
                    sh "node -v"
                    sh "npm install"
                    sh "npm run build-docker"
                }
            }
        }
    }
}
