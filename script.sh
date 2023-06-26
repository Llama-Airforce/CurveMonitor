#!/bin/sh

# pull the latest changes from your repository
git pull

# build the Docker image
docker build -t curvemonitor .

# check if the container already exists
existing_container=$(docker ps -a -q -f name=curvemonitor-container)

if [ -n "$existing_container" ]; then
    # stop and remove the existing container if it exists
    docker stop curvemonitor-container
    docker rm curvemonitor-container
fi

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
counter=0
while ! docker exec some-postgres pg_isready -U postgres; do
  sleep 1
  counter=$((counter + 1))
  if [ $counter -ge 5 ]; then
    echo "Could not connect to PostgreSQL after 5 seconds, aborting."
    exit 1
  fi
done

# run the new Docker image
docker run -d --network some-network --name curvemonitor-container -p 3000:3000 \
    --env-file .env \
    curvemonitor:latest

# view the application logs
docker logs -f curvemonitor-container