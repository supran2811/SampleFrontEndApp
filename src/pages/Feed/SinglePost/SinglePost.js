import React, { Component } from 'react';
import path from 'path';
import Image from '../../../components/Image/Image';
import './SinglePost.css';

class SinglePost extends Component {
  state = {
    title: '',
    author: '',
    date: '',
    image: '',
    content: ''
  };

  componentDidMount() {
    const postId = this.props.match.params.postId;
    const graphQlQuery = {
      query : `{
        getPost(postId:"${postId}") {
          title
          content
          imageUrl,
          createdAt,
          creator { name }
        }
      }`
    }
    fetch('/graphql',{
      method:'POST',
      body:JSON.stringify(graphQlQuery),
      headers:{
        'Authorization' :'Bearer '+this.props.token,
        'Content-Type' : 'application/json'
      }
    }
    )
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors) {
          throw new Error('Failed to fetch status');
        }

        this.setState({
          title: resData.data.getPost.title,
          author: resData.data.getPost.creator.name,
          date: new Date(resData.data.getPost.createdAt).toLocaleDateString('en-US'),
          content: resData.data.getPost.content,
          image: resData.data.getPost.imageUrl
        });
      })
      .catch(err => {
        console.log(err);
      });
  }

  render() {
    const normalizeUrl = this.state.image.replace('\\' , path.sep);
    return (
      <section className="single-post">
        <h1>{this.state.title}</h1>
        <h2>
          Created by {this.state.author} on {this.state.date}
        </h2>
        <div className="single-post__image">
          <Image contain imageUrl={normalizeUrl} />
        </div>
        <p>{this.state.content}</p>
      </section>
    );
  }
}

export default SinglePost;
