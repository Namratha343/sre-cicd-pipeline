pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        IMAGE_NAME    = "namratha3/sre-cicd-pipeline"
        EMAIL_TO      = "namratha343@gmail.com"
        SONAR_PROJECT = "sre-cicd-pipeline"
    }
    stages {
        stage("Git Checkout") {
            steps {
                git branch: 'main',
                    credentialsId: 'git-cred',
                    url: 'https://github.com/Namratha343/sre-cicd-pipeline.git'
            }
        }
        stage("SonarQube Analysis") {
            steps {
                withSonarQubeEnv('sonarqube') {
                    sh """
                    sonar-scanner \
                        -Dsonar.projectKey=${SONAR_PROJECT} \
                        -Dsonar.projectName="${SONAR_PROJECT}" \
                        -Dsonar.sources=app \
                        -Dsonar.language=py \
                        -Dsonar.python.version=3
                    """
                }
            }
        }

        stage("Quality Gate") {
            steps {
                timeout(time: 3, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        stage("Trivy FS Scan") {
            steps {
                sh """
                docker run --rm \
                -v ${WORKSPACE}:/app \
                aquasec/trivy:latest fs \
                --no-progress \
                --format table \
                --severity HIGH,CRITICAL \
                /app > trivy-fs-report.txt
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'trivy-fs-report.txt', allowEmptyArchive: true
                }
            }
        }
        stage("Docker Login") {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                }
            }
        }
        stage("Build & Push Docker Image") {
            steps {
                script {
                    env.IMAGE_TAG = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()

                    sh """
                    docker buildx use sre-builder || \
                        docker buildx create --name sre-builder --driver docker-container --use

                    docker buildx inspect --bootstrap

                    docker buildx build \
                        --platform linux/amd64 \
                        -f Dockerfile \
                        --cache-from=type=registry,ref=${IMAGE_NAME}:buildcache \
                        --cache-to=type=registry,ref=${IMAGE_NAME}:buildcache,mode=max \
                        -t ${IMAGE_NAME}:latest \
                        -t ${IMAGE_NAME}:${env.IMAGE_TAG} \
                        --push \
                        .
                    """
                }
            }
        }
        stage("Trivy Image Scan") {
            steps {
                sh """
                docker run --rm \
                -v /var/run/docker.sock:/var/run/docker.sock \
                aquasec/trivy:latest image \
                --no-progress \
                --format table \
                --severity HIGH,CRITICAL \
                ${IMAGE_NAME}:${env.IMAGE_TAG} \
                > trivy-image-report.txt
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'trivy-image-report.txt', allowEmptyArchive: true
                }
            }
        }
        stage("Deploy to Kubernetes") {
            steps {
                withCredentials([file(
                    credentialsId: 'kubeconfig',
                    variable: 'KUBECONFIG'
                )]) {
                    sh """
                    kubectl apply -f k8s/namespace.yaml --kubeconfig=\$KUBECONFIG
                    kubectl apply -f k8s/service.yaml   --kubeconfig=\$KUBECONFIG

                    sed "s|IMAGE_TAG|${env.IMAGE_TAG}|g" k8s/deployment.yaml \
                        | kubectl apply -f - --kubeconfig=\$KUBECONFIG

                    kubectl rollout status deployment/sre-cicd-pipeline \
                        -n sre-cicd \
                        --timeout=120s \
                        --kubeconfig=\$KUBECONFIG
                    """
                }
            }
        }

    }
    post {
        success {
            slackSend(
                channel: "#all-jenkins-cicd",
                color: "good",
                message: "SUCCESS: ${JOB_NAME} #${BUILD_NUMBER} deployed ${IMAGE_NAME}:${env.IMAGE_TAG}"
            )
        }

        failure {
            slackSend(
                channel: "#all-jenkins-cicd",
                color: "danger",
                message: "FAILED: ${JOB_NAME} #${BUILD_NUMBER} - ${BUILD_URL}"
            )
        }
    }
        
}
