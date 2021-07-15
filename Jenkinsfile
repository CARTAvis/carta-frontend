void setBuildStatus(String message, String state) {
  step([
      $class: "GitHubCommitStatusSetter",
      reposSource: [$class: "ManuallyEnteredRepositorySource", url: "https://github.com/CARTAvis/carta-frontend"],
      contextSource: [$class: "ManuallyEnteredCommitContextSource", context: "ci/jenkins/build-status"],
      errorHandlers: [[$class: "ChangingBuildStatusErrorHandler", result: "UNSTABLE"]],
      statusResultSource: [ $class: "ConditionalStatusResultSource", results: [[$class: "AnyBuildResult", message: message, state: state]] ]
  ]);
}

pipeline {
    agent none
    stages {
        stage('Format check') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE')
                sh "git submodule update --init --recursive"
                sh "npm install"
                sh "npm run checkformat"
            }
        }
        stage('WebAssembly compilation') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE')
                sh "git submodule update --init --recursive"
                sh "npm run build-libs-docker"
                stash includes: "carta_frontend", name: "carta_frontend_with_built_libs"
            }
        }
        stage('node v12') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE')
                unstash "carta_frontend_with_built_libs"
                sh "rm -rf node_modules"
                sh "nvm use 12"
                sh "node -v"
                sh "npm install"
                sh "npm run build-docker"
            }
        }
        stage('node v14') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE')
                unstash "carta_frontend_with_built_libs"
                sh "rm -rf node_modules"
                sh "nvm use 14"
                sh "node -v"
                sh "npm install"
                sh "npm run build-docker"
            }
        }
        stage('node v16') {
            agent {
                label "macos-1"
            }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE')
                unstash "carta_frontend_with_built_libs"
                sh "rm -rf node_modules"
                sh "nvm use 16"
                sh "node -v"
                sh "npm install"
                sh "npm run build-docker"
            }
        }
    }
}
