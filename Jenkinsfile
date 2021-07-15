pipeline {
    agent none
    stages {
        stage('Format check') {
            agent {
                label "ubuntu-1"
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
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    sh "git submodule update --init --recursive"
                    sh "npm run build-libs-docker"
                    sh "pwd"
                    sh "ls -sort"
                    stash includes: "wasm_libs", name: "built_wasm_libs"
                }
            }
        }
        stage('node v12') {
            agent {
                label "ubuntu-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    unstash 'built_wasm_libs'
                    sh 'rm -rf node_modules'
                    sh 'export NVM_DIR="/home/acdc/.nvm"'
                    sh '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
                    sh '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"'
                    sh 'nvm install 12 && nvm use 12'
                    sh 'node -v'
                    sh 'npm install'
                    sh 'npm run build-docker'
                }
            }
        }
    }
}
