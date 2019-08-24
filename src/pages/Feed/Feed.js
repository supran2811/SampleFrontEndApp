import React, { Component, Fragment } from 'react';
import path from 'path';
import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    const graphQlQuery = {
      query: `
        {
          getUser {
            status
          }
        }
      `
    }
    fetch('/graphql', {
      headers:{
        Authorization: 'Bearer '+this.props.token,
        'Content-Type' : 'application/json'
      },
      method:'POST',
      body:JSON.stringify(graphQlQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors) {
          throw new Error('Failed to fetch user status.');
        }
        console.log("REsponse for user status",resData);
        this.setState({ status: resData.data.getUser.status });
      })
      .catch(this.catchError);

    this.loadPosts();

  }
   
  loadPosts = direction => {
    if (direction) {
      this.setState({ postsLoading: true, posts: [] });
    }
    let page = this.state.postPage;
    if (direction === 'next') {
      page++;
      this.setState({ postPage: page });
    }
    if (direction === 'previous') {
      page--;
      this.setState({ postPage: page });
    }

    const graphqlQuery = {
      query : `
       query FetchPosts($page: Int!) {
          getPosts(page:$page) {
            posts {
              _id
              title
              content
              imageUrl
              createdAt
              updatedAt
              creator { name }
            }
            totalItems
          }
        }
      `,
      variables:{
        page
      }
    }

    fetch('/graphql',{
      method:'POST',
      body:JSON.stringify(graphqlQuery),
      headers:{
        'Authorization' :'Bearer '+this.props.token,
        'Content-Type' : 'application/json'
      }
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors && resData.errors[0].status !== 200) {
          throw new Error('Failed to fetch posts.');
        }

        this.setState({
          posts: resData.data.getPosts.posts,
          totalPosts: resData.data.getPosts.totalItems,
          postsLoading: false
        });
      })
      .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();
    const graphQlQuery = {
      query: `
        mutation UpdateStatus($status: String!) {
          updateStatus(status: $status)
        }
      `,
      variables: {
        status: this.state.status
      }
    }
    fetch('graphql' , {
      method:'POST',
      body:JSON.stringify(graphQlQuery),
      headers:{
        Authorization:'Bearer '+this.props.token,
        'Content-Type':'application/json'
      }
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors) {
          throw new Error("Can't update status!");
        }
        console.log(resData);
      })
      .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = { ...prevState.posts.find(p => p._id === postId) };

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  finishEditHandler = postData => {
    this.setState({
      editLoading: true
    });
  
    const formData = new FormData();
    formData.append('image' , postData.image);
    if(this.state.editPost) {

      formData.append('oldImageUrl' , this.state.editPost.imageUrl);
    }
    fetch('/uploadImage' , {
      method:'POST',
      headers:{
        'Authorization' :'Bearer '+this.props.token,
      },
      body:formData
    }).then(res => {
        return res.json();
    }).then(result => {
     
      const normalizeUrl = result.path ? result.path.replace('\\' , path.sep) : null;


      let graphqlQuery = {
        query: `
          mutation CreatePost($title: String! , $content: String! , $imageUrl: String!) {
            createPost(postInput: {title:$title , 
              content:$content , 
              imageUrl:$imageUrl}) {
              _id
              title
              content
              imageUrl
              createdAt
              updatedAt
              creator { name }
            }
          }
        `,
        variables: {
          title: postData.title,
          content: postData.content,
          imageUrl: normalizeUrl
        }
      };

      if(this.state.editPost) {
        graphqlQuery = {
          query: `
            mutation UpdatePost($id: ID! , $title: String! , $content: String! , $imageUrl: String) {
              updatePost(postInput: {id:$id , title:$title , 
                content:$content , 
                imageUrl:$imageUrl}) {
                _id
                title
                content
                imageUrl
                createdAt
                updatedAt
                creator { name }
              }
            }
          `,
          variables:{
            id: this.state.editPost._id.toString(),
            title: postData.title,
            content: postData.content,
            imageUrl: normalizeUrl
          }
        };
      }
      return fetch("/graphql" , {
        method:'POST',
        body:JSON.stringify(graphqlQuery),
        headers:{
          'Authorization' :'Bearer '+this.props.token,
          'Content-Type': 'application/json' 
        }
      })    
    } ).then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors && resData.errors[0].status !== 200) {
          throw new Error('Creating or editing a post failed!');
        }
        console.log(resData);
        this.setState(prevState => {
          const updatedPost = [...prevState.posts];
          if(this.state.editPost) {
            const index = updatedPost.findIndex(p => p._id === this.state.editPost._id);
            console.log("Editing post",this.state.editPost._id , index);
            if(index >= 0) {
              updatedPost[index] = {...resData.data.updatePost};
            }
          }
          else {
           if (prevState.posts.length >= 2) {
            updatedPost.pop();
            }
            updatedPost.unshift({...resData.data.createPost});
          }
          return {
            posts:updatedPost,
            isEditing: false,
            editPost: null,
            editLoading: false
          };
        });
      })
      .catch(err => {
        this.setState({
          isEditing: false,
          editPost: null,
          editLoading: false,
          error: err
        });
      });
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ status: value });
  };

  deletePostHandler = postId => {
    this.setState({ postsLoading: true });

    const graphqlQuery = {
      query: `
        mutation DeletePost($postId: ID!) {
          deletePost(id: $postId )
        }
      `,
      variables: {
        postId
      }
    };

    fetch('/graphql' , {
      method:'POST',
      body:JSON.stringify(graphqlQuery),
      headers:{
        'Authorization' :'Bearer '+this.props.token,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
         return res.json();
      })
      .then(resData => {
        if (!resData ||  resData.errors) {
          throw new Error('Deleting a post failed!');
        }
        this.setState(prevState => {
          const updatedPosts = prevState.posts.filter(p => p._id !== postId);
          return { posts: updatedPosts, postsLoading: false };
        });
      })
      .catch(err => {
        console.log(err);
        this.setState({ postsLoading: false });
      });
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = error => {
    this.setState({ error: error });
  };

  render() {

    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: 'center' }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => {
                const normalizeUrl = post.imageUrl.replace('\\' , path.sep);
                
                return <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={normalizeUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
               })}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
