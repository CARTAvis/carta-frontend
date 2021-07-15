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
                    sh "pwd"
                    sh "ls -sort"
                    stash includes: "wasm_libs", name: "built_wasm_libs"
                }
            }
        }
        stage('node v12') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    unstash 'built_wasm_libs'
                    sh 'rm -rf node_modules'
                    sh 'export NVM_DIR=/Users/acdc/.nvm'
                    sh '[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"'
                    sh '[ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && . "/usr/local/opt/nvm/etc/bash_completion.d/nvm"'
                    sh 'nvm install 12 && nvm use 12'
                    sh 'node -v'
                    sh 'npm install'
                    sh 'npm run build-docker'
                }
            }
        }
    }
}
