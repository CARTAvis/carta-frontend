pipeline {
    agent none
    environment {
        COMMIT_ID=''
    }
    stages {
        stage('WebAssembly compilation') {
            agent {
                label "ubuntu2004-agent"
            }
            steps {
                script {
                    COMMIT_ID = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
                }
                sh "git submodule update --init --recursive"
                sh "n exec 14 npm run build-libs-docker"
                stash includes: "protobuf/**/*", name: "protobuf" 
                stash includes: "wasm_libs/built/**/*,wasm_libs/zstd/build/standalone_zstd.bc", name: "wasm_libs"
            }
        }
        stage('Build') {
            parallel {
                stage('Build with node v12') {
                    agent {
                        label "ubuntu2004-agent"
                    }
                    steps {
                        unstash "protobuf"
                        unstash "wasm_libs"
                        sh "uname -a"
                        sh "lsb_release -a"
                        sh 'rm -rf node_modules build'
                        sh 'n 12'
                        sh 'n exec 12 node -v'
                        sh 'n exec 12 npm install'
                        sh 'n exec 12 npm run build-docker'
                    }
                }
                stage('Build with node v14') {
                    agent {
                        label "almalinux85-agent"
                    }
                    steps {
                        unstash "protobuf"
                        unstash "wasm_libs"
                        sh "uname -a"
                        sh "lsb_release -a"
                        sh 'rm -rf node_modules build'
                        sh 'n 14' 
                        sh 'n exec 14 node -v'
                        sh 'n exec 14 npm install'
                        sh 'n exec 14 npm run build-docker'
                    }
                }
                stage('Build with node v16') {
                    agent {
                       label "almalinux86-agent"
                    }
                    steps {
                        unstash "protobuf"
                        unstash "wasm_libs"
                        sh "uname -a"
                        sh "lsb_release -a"
                        sh 'rm -rf node_modules build'
                        sh 'n 16'
                        sh 'n exec 16 node -v'
                        sh 'n exec 16 npm install --legacy-peer-deps'
                        sh 'n exec 16 npm run build-docker'
                    }
                }
            }
        }
    }
    post {
        success {
            slackSend color: 'good', message: "carta-frontend - Success - ${env.BRANCH_NAME} <${env.RUN_DISPLAY_URL}|${COMMIT_ID}>";
        }
        failure {
            slackSend color: 'danger', message: "carta-frontend - Fail - ${env.BRANCH_NAME} <${env.RUN_DISPLAY_URL}|${COMMIT_ID}>";
        }
    }
}
